import http from 'node:http';
import dgram from 'node:dgram';
import {createReadStream} from 'node:fs';
import {mkdir, realpath, stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createNativeStorage, nativeBinary, startNativeCapture} from './native.mjs';
import {createAdapters} from './adapters.mjs';
import {createStorage, validId} from './storage.mjs';
import lockfile from 'proper-lockfile';

const here = dirname(fileURLToPath(import.meta.url));
const labels = {f1: 'F1', iracing: 'iRacing', rfactor2: 'rFactor 2'};
const httpError = (status, message) => Object.assign(new Error(message), {status});
const publicError = error => error.status ? error.message : 'A local server operation failed.';

function integer(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) throw new Error('Invalid server port or recording limit.');
  return Number(value);
}

export function configuration(args = [], env = process.env) {
  const flags = {};
  const allowed = new Set(['port', 'f1-port', 'iracing-port', 'rfactor2-port', 'data-dir', 'udp-host', 'static-dir']);
  for (let index = 0; index < args.length; index++) {
    const key = args[index].replace(/^--/, '');
    if (!args[index].startsWith('--') || !allowed.has(key) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Unknown or incomplete server option.');
    flags[key] = args[++index];
  }
  const udpHost = flags['udp-host'] ?? env.RACEHUB_UDP_HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(udpHost)) throw new Error('UDP host must be 127.0.0.1 or 0.0.0.0.');
  return {
    port: integer(flags.port ?? env.RACEHUB_PORT, 8081, 0, 65535),
    ports: {
      f1: integer(flags['f1-port'] ?? env.RACEHUB_F1_PORT, 20777, 0, 65535),
      iracing: integer(flags['iracing-port'] ?? env.RACEHUB_IRACING_PORT, 20900, 0, 65535),
      rfactor2: integer(flags['rfactor2-port'] ?? env.RACEHUB_RFACTOR2_PORT, 20888, 0, 65535),
    },
    udpHost,
    directory: resolve(flags['data-dir'] ?? env.RACEHUB_DATA_DIR ?? join(homedir(), 'Documents', 'RaceHub', 'sessions')),
    staticDirectory: flags['static-dir'] ?? env.RACEHUB_STATIC_DIR,
    nativeBinary: env.RACEHUB_NATIVE_BINARY,
    origins: (env.RACEHUB_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
    limits: {
      maxRows: integer(env.RACEHUB_MAX_ROWS, 500000, 1, 500000),
      maxBytes: integer(env.RACEHUB_MAX_BYTES, 128 * 1024 * 1024, 1024, 128 * 1024 * 1024),
      maxPendingBytes: 4 * 1024 * 1024,
    },
  };
}

export async function startCollector(options = configuration()) {
  await mkdir(options.directory, {recursive: true, mode: 0o700});
  const lockState = {lost: false};
  let collector;
  let release;
  try {
    release = await lockfile.lock(options.directory, {
      lockfilePath: join(options.directory, '.collector.lock'), stale: 30000, update: 10000, retries: 0,
      onCompromised() {
        lockState.lost = true;
        collector?.close().catch(() => {});
      },
    });
  } catch (error) {
    if (error.code === 'ELOCKED') throw Object.assign(new Error('Another collector uses this recording directory. Stop it first. After a crash, wait 30 seconds and retry.'), {code: 'ELOCKED'});
    throw error;
  }
  try {
    collector = await startLockedCollector(options, release, lockState);
    if (lockState.lost) { await collector.close(); throw new Error('The recording directory lock was lost.'); }
    return collector;
  }
  catch (error) { await release().catch(() => {}); throw error; }
}

async function startLockedCollector(options, release, lockState) {
  const adapters = await createAdapters();
  const storage = await createStorage(options.directory, options.limits);
  const nativeStorage = await createNativeStorage(options.directory);
  const native = await nativeBinary(options.nativeBinary);
  if (lockState.lost) throw new Error('The recording directory lock was lost.');
  const clients = new Set();
  const sockets = new Map();
  const receivers = Object.fromEntries(Object.keys(labels).map(simulator => [simulator, {listening: false, packets: 0, rejected: 0, lastPacketAt: null}]));
  let recording = null;
  let errorMessage = storage.recovered.length ? 'An interrupted recording was recovered.' : null;
  let operation = Promise.resolve();
  let liveRows = [];
  let port = options.port;
  let closed = false;
  const ports = {...options.ports};
  const status = () => ({
    recording: Boolean(recording), simulator: recording?.metadata.simulator ?? null,
    name: recording?.metadata.name ?? null, sampleCount: recording?.metadata.rowCount ?? 0,
    scope: recording?.metadata.scope ?? null, sampleHz: recording?.metadata.sampleHz ?? null,
    engine: recording?.kind ?? null, nativeAvailable: Boolean(native),
    captureRate: recording?.kind === 'native' ? 'source' : 'sampled',
    counters: recording?.counters ?? null,
    lastSampleAt: recording?.metadata.lastSampleAt ?? null, error: errorMessage,
    ports: {...ports}, receivers, limits: {maxRows: options.limits.maxRows, maxBytes: options.limits.maxBytes, minSampleHz: 1, maxSampleHz: 60, defaultSampleHz: 10, defaultScope: 'player'},
  });
  function sendEvent(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const response of clients) {
      if (response.destroyed || response.writableEnded || response.writableLength > 2 * 1024 * 1024) { response.destroy(); clients.delete(response); }
      else response.write(message);
    }
  }
  const sendStatus = () => sendEvent('status', status());
  function flushSamples() {
    if (liveRows.length) { const rows = liveRows; liveRows = []; sendEvent('sample', rows); }
  }
  function serial(callback) {
    const next = operation.then(callback);
    operation = next.catch(() => {});
    return next;
  }
  function appendSample(current, row) {
    current.append(row); liveRows.push(row);
    if (liveRows.length > 512) liveRows.splice(0, liveRows.length - 512);
  }
  async function stopRecording() {
    const current = recording;
    if (!current) return null;
    if (lockState.lost) {
      recording = null; liveRows = [];
      await current.abort();
      throw httpError(503, 'The recording directory lock was lost. Restart the collector after the other writer stops.');
    }
    if (current.kind === 'native') {
      current.stopping = true;
      try {
        await current.native.stop();
        const session = await nativeStorage.get(current.metadata.id);
        if (!session) throw httpError(500, 'The native recording could not be finalized. Its raw files remain on disk.');
        if (session?.rowCount) sendEvent('session', {...session, parts: undefined});
        return session?.rowCount ? {...session, parts: undefined} : null;
      } catch (error) {
        errorMessage = publicError(error);
        throw error;
      } finally {
        recording = null;
        if (!closed && !lockState.lost) await bindReceiver(current.metadata.simulator);
        sendStatus();
      }
    }
    for (const state of current.samples.values()) {
      if (state.row !== state.written) {
        try { appendSample(current, state.row); }
        catch (error) { errorMessage = error.message; break; }
      }
    }
    flushSamples(); current.stopping = true;
    try {
      const session = await current.finish();
      recording = null;
      if (session.rowCount) sendEvent('session', session);
      else await storage.delete(session.id);
      sendStatus(); return session.rowCount ? session : null;
    } catch {
      recording = null;
      errorMessage = 'The recording could not be finalized. Its local files remain for recovery.';
      sendStatus(); throw httpError(500, errorMessage);
    }
  }
  function stopWithError(message) {
    errorMessage = message;
    if (recording && !recording.stopping) {
      recording.stopping = true;
      serial(stopRecording).catch(() => {});
    }
    sendStatus();
  }
  function accept(simulator, packet) {
    if (closed || lockState.lost || !recording || recording.kind === 'native' || recording.stopping || recording.metadata.simulator !== simulator || !packet.rows.length) return;
    if (recording.sourceSessionKey && recording.sourceSessionKey !== packet.sessionKey) {
      stopWithError('The game session changed. The recording was saved. Start a new recording for the new session.');
      return;
    }
    const latestTime = packet.rows[packet.rows.length - 1].sessionTime;
    if (recording.lastSourceTime !== undefined && latestTime < recording.lastSourceTime - 2) {
      stopWithError('The game clock moved backwards. The recording was saved. Start a new recording for this segment.');
      return;
    }
    recording.sourceSessionKey = packet.sessionKey;
    recording.lastSourceTime = latestTime;
    if (recording.metadata.scope === 'player' && !packet.playerParticipantId) {
      if (!recording.waitingForPlayer) {
        recording.waitingForPlayer = true;
        errorMessage = 'The player is not identified. Waiting for player telemetry. Select all drivers for a spectator recording.';
        sendStatus();
      }
      return;
    }
    if (recording.waitingForPlayer) { recording.waitingForPlayer = false; errorMessage = null; sendStatus(); }
    const receivedAt = new Date().toISOString();
    try {
      for (const row of packet.rows) {
        if (recording.metadata.scope === 'player' && row.participantId !== packet.playerParticipantId) continue;
        const sample = {...row, receivedAt};
        const previous = recording.samples.get(row.participantId);
        if (previous && row.sessionTime < previous.row.sessionTime) continue;
        const boundary = previous && ((row.lap_number !== undefined && previous.row.lap_number !== undefined && row.lap_number !== previous.row.lap_number)
          || (typeof row.lap_time === 'number' && typeof previous.row.lap_time === 'number' && row.lap_time + 1000 < previous.row.lap_time));
        if (previous && row.sessionTime === previous.row.sessionTime && !boundary) continue;
        if (!previous && recording.samples.size >= 256) throw new Error('The recording has too many driver identities.');
        if (boundary && previous.row !== previous.written) appendSample(recording, previous.row);
        const due = !previous || boundary || row.sessionTime - previous.written.sessionTime >= 1 / recording.metadata.sampleHz - 1e-7;
        if (due) appendSample(recording, sample);
        recording.samples.set(row.participantId, {row: sample, written: due ? sample : previous.written});
      }
    } catch (error) { stopWithError(error.message); }
  }
  async function bindReceiver(simulator) {
    const socket = dgram.createSocket('udp4'); sockets.set(simulator, socket);
    socket.on('message', buffer => {
      const receiver = receivers[simulator];
      receiver.packets++; receiver.lastPacketAt = new Date().toISOString();
      if (!recording || recording.kind === 'native' || recording.metadata.simulator !== simulator) return;
      try {
        const packet = adapters[simulator](buffer);
        if (packet.rows.length) receiver.playerAvailable = Boolean(packet.playerParticipantId);
        accept(simulator, packet);
      } catch {
        receiver.rejected++;
        if (recording?.metadata.simulator === simulator && receiver.rejected % 100 === 1) {
          errorMessage = `An invalid ${labels[simulator]} packet was rejected. Listening continues.`;
          sendStatus();
        }
      }
    });
    socket.on('error', () => {
      receivers[simulator].listening = false;
      const message = `The ${labels[simulator]} UDP port is unavailable. Stop the other recorder or select another port.`;
      if (recording?.metadata.simulator === simulator) stopWithError(message);
      else { errorMessage = message; sendStatus(); }
    });
    await new Promise(resolveBind => {
      socket.once('error', resolveBind);
      socket.bind(ports[simulator], options.udpHost, () => {
        ports[simulator] = socket.address().port; receivers[simulator].listening = true;
        resolveBind();
      });
    });
  }
  for (const simulator of Object.keys(labels)) await bindReceiver(simulator);
  const allowedOrigins = () => new Set([
    `http://127.0.0.1:${port}`, `http://localhost:${port}`,
    'http://127.0.0.1:3000', 'http://localhost:3000', ...options.origins,
  ]);
  function validateRequest(request, response) {
    if (closed || lockState.lost) throw httpError(503, 'The collector is stopping. Restart it before recording.');
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!hosts.has(request.headers.host)) throw httpError(403, 'The Host header is not allowed.');
    const origin = request.headers.origin;
    if (origin && !allowedOrigins().has(origin)) throw httpError(403, 'The browser origin is not allowed.');
    if (!origin && request.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, 'Cross-site requests are not allowed.');
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
  }
  function json(response, code, value) {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    response.end(JSON.stringify(value));
  }
  async function body(request) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw httpError(415, 'Use application/json.');
    if (Number(request.headers['content-length']) > 4096) throw httpError(413, 'The request body exceeds 4096 bytes.');
    const chunks = []; let bytes = 0;
    for await (const chunk of request.iterator({destroyOnReturn: false})) {
      bytes += chunk.length;
      if (bytes > 4096) { request.resume(); throw httpError(413, 'The request body exceeds 4096 bytes.'); }
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value;
    } catch { throw httpError(400, 'The request body must be a JSON object.'); }
  }
  async function write(response, chunk) {
    if (!response.write(chunk)) await once(response, 'drain', {signal: AbortSignal.timeout(15000)});
  }
  async function staticFile(request, response, pathname) {
    let path;
    try { path = decodeURIComponent(pathname); }
    catch { throw httpError(400, 'Invalid URL encoding.'); }
    if (path.includes('\0') || path.split('/').some(part => part === '..' || part.startsWith('.'))) throw httpError(404, 'File not found.');
    let directory;
    for (const candidate of options.staticDirectory ? [resolve(options.staticDirectory)] : [join(here, '../dist'), join(here, '../build')]) {
      if ((await stat(join(candidate, 'index.html')).catch(() => null))?.isFile()) { directory = candidate; break; }
    }
    if (!directory) throw httpError(404, 'Build the web app before you open it from this server.');
    let filename = resolve(directory, `.${path}`);
    if (!filename.startsWith(directory + sep) && filename !== directory) throw httpError(404, 'File not found.');
    let info = await stat(filename).catch(() => null);
    if (!info?.isFile() && !extname(path)) { filename = join(directory, 'index.html'); info = await stat(filename); }
    if (!info?.isFile()) throw httpError(404, 'File not found.');
    const root = await realpath(directory);
    filename = await realpath(filename);
    if (!filename.startsWith(root + sep)) throw httpError(404, 'File not found.');
    const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'};
    response.writeHead(200, {'Content-Type': types[extname(filename)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache'});
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(filename);
    stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response);
  }
  const server = http.createServer({maxHeaderSize: 16384}, async (request, response) => {
    try {
      validateRequest(request, response);
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Range', 'Access-Control-Max-Age': '300'}); response.end(); return;
      }
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      const path = url.pathname;
      if (request.method === 'GET' && path === '/api/status') return json(response, 200, status());
      if (request.method === 'GET' && path === '/api/sessions') {
        const sessions = [...await storage.list(recording?.metadata.id), ...await nativeStorage.list(recording?.metadata.id)];
        return json(response, 200, {sessions: sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))});
      }
      const nativePart = path.match(/^\/api\/native\/sessions\/([^/]+)\/parts\/([^/]+)$/);
      if (nativePart) return await nativeStorage.serve(nativePart[1], decodeURIComponent(nativePart[2]), request, response);
      const nativeSession = path.match(/^\/api\/native\/sessions\/([^/]+)$/);
      if (nativeSession && request.method === 'GET') {
        const session = await nativeStorage.get(nativeSession[1]);
        if (!session) throw httpError(404, 'Native session not found.');
        return json(response, 200, session);
      }
      if (request.method === 'GET' && path === '/api/events') {
        if (clients.size >= 8) throw httpError(429, 'Too many event connections.');
        response.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'});
        response.write(`event: status\ndata: ${JSON.stringify(status())}\n\n`);
        clients.add(response); response.on('close', () => clients.delete(response)); response.on('error', () => clients.delete(response)); return;
      }
      if (request.method === 'POST' && path === '/api/recording/start') {
        const value = await body(request);
        if (Object.keys(value).some(key => !['simulator', 'name', 'scope', 'sampleHz', 'engine'].includes(key)) || typeof value.simulator !== 'string' || !Object.hasOwn(labels, value.simulator)) throw httpError(400, 'Select f1, iracing, or rfactor2.');
        if (value.name !== undefined && (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120)) throw httpError(400, 'The recording name must contain 1 to 120 characters.');
        const scope = value.scope === undefined ? 'player' : value.scope;
        const sampleHz = value.sampleHz === undefined ? 10 : value.sampleHz;
        const engine = value.engine ?? 'javascript';
        if (!['native', 'javascript'].includes(engine)) throw httpError(400, 'Select native or javascript recording.');
        if (engine === 'native' && !native) throw httpError(409, 'Build the native collector and restart the local server to record source-rate Parquet.');
        if (!['player', 'all'].includes(scope)) throw httpError(400, 'Select player or all drivers.');
        if (engine === 'javascript' && (!Number.isInteger(sampleHz) || sampleHz < 1 || sampleHz > 60)) throw httpError(400, 'The sample rate must be a whole number from 1 to 60 Hz.');
        return json(response, 200, await serial(async () => {
          if (closed || lockState.lost) throw httpError(503, 'The collector is stopping.');
          if (recording) throw httpError(409, 'A recording is already active.');
          if (!receivers[value.simulator].listening) throw httpError(409, 'The selected UDP port is not available.');
          const name = value.name?.trim() ?? `${labels[value.simulator]} ${new Date().toISOString()}`;
          errorMessage = null; liveRows = [];
          if (engine === 'native') {
            const id = randomUUID();
            const directory = await nativeStorage.create(id);
            const current = {kind: 'native', metadata: {id, simulator: value.simulator, name, scope, rowCount: 0, sampleHz: null},
              counters: {}, native: null, abort() { return this.native?.abort(); }};
            await new Promise(resolveClose => {
              const socket = sockets.get(value.simulator);
              try { socket.close(resolveClose); } catch { resolveClose(); }
            });
            receivers[value.simulator].listening = false;
            try {
              current.native = await startNativeCapture(native, {id, directory, simulator: value.simulator,
                host: options.udpHost, port: ports[value.simulator], name, scope}, event => {
                if (event.event === 'ready') { ports[value.simulator] = event.port; receivers[value.simulator].listening = true; }
                if (event.event === 'status') {
                  current.counters = Object.fromEntries(['received', 'rejected', 'dropped', 'rows'].filter(key => Number.isSafeInteger(event[key]) && event[key] >= 0).map(key => [key, event[key]]));
                  if (Number.isSafeInteger(event.rows) && event.rows >= 0) current.metadata.rowCount = event.rows;
                  if (event.received > 0) current.metadata.lastSampleAt = new Date().toISOString();
                  if (typeof event.error === 'string' && event.error) errorMessage = event.error.slice(0, 240);
                  if (event.dropped > 0) errorMessage = 'The native queue overflowed. The capture counters report missing packets.';
                  sendStatus();
                }
                if (event.event === 'sample' && Array.isArray(event.rows)) sendEvent('sample', event.rows.slice(-22));
                if (event.event === 'error') { const message = event.message ?? event.error; errorMessage = typeof message === 'string' ? message.slice(0, 240) : 'The native collector reported an error.'; sendStatus(); }
              });
              recording = current;
              current.native.done.then(() => {
                if (recording === current && !current.stopping) serial(stopRecording).catch(() => {});
              }, () => { if (recording === current && !current.stopping) stopWithError('The native collector stopped. Check the raw recording before you start again.'); });
            } catch (failure) {
              await bindReceiver(value.simulator);
              throw failure;
            }
          } else {
            recording = await storage.start(value.simulator, name, scope, sampleHz);
            recording.kind = 'javascript'; recording.samples = new Map();
          }
          sendStatus(); return status();
        }));
      }
      if (request.method === 'POST' && path === '/api/recording/stop') {
        if (request.headers['transfer-encoding'] || (request.headers['content-length'] !== undefined && request.headers['content-length'] !== '0')) {
          const value = await body(request); if (Object.keys(value).length) throw httpError(400, 'The stop request does not accept options.');
        }
        return json(response, 200, await serial(async () => ({session: await stopRecording(), status: status()})));
      }
      const match = path.match(/^\/api\/sessions\/([^/]+)$/);
      if (match) {
        const id = match[1];
        if (!validId(id)) throw httpError(400, 'Invalid session ID.');
        if (request.method === 'DELETE') {
          const deleted = await serial(async () => {
            if (closed || lockState.lost) throw httpError(503, 'The collector is stopping.');
            if (recording?.metadata.id === id) throw httpError(409, 'Stop the recording before you delete it.');
            return await storage.delete(id) || await nativeStorage.delete(id);
          });
          if (!deleted) throw httpError(404, 'Session not found.');
          sendEvent('deleted', {id}); return json(response, 200, {deleted: id});
        }
        if (request.method === 'GET') {
          const nativeSession = await nativeStorage.get(id);
          if (nativeSession) return json(response, 200, nativeSession);
          const session = await storage.get(id);
          if (!session) throw httpError(404, 'Session not found.');
          response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
          await write(response, `${JSON.stringify(session.metadata).slice(0, -1)},"rows":[`);
          let first = true;
          for await (const row of session.rows()) { await write(response, `${first ? '' : ','}${JSON.stringify(row)}`); first = false; }
          response.end(']}'); return;
        }
      }
      if (path.startsWith('/api/')) throw httpError(404, 'API endpoint not found.');
      if (!['GET', 'HEAD'].includes(request.method)) throw httpError(405, 'Method not allowed.');
      await staticFile(request, response, path);
    } catch (error) {
      if (response.headersSent) response.destroy();
      else json(response, error.status ?? 500, {error: publicError(error)});
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  try { server.listen(port, '127.0.0.1'); await once(server, 'listening'); }
  catch (error) { for (const socket of sockets.values()) { try { socket.close(); } catch {} } throw error; }
  port = server.address().port;
  const sampleTimer = setInterval(flushSamples, 250);
  const statusTimer = setInterval(sendStatus, 2000);
  const heartbeat = setInterval(() => { for (const response of clients) if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000);
  for (const timer of [sampleTimer, statusTimer, heartbeat]) timer.unref();
  return {
    port, status,
    async close() {
      if (closed) return; closed = true;
      for (const timer of [sampleTimer, statusTimer, heartbeat]) clearInterval(timer);
      await serial(stopRecording).catch(() => {});
      for (const response of clients) response.end(); clients.clear();
      for (const socket of sockets.values()) { try { socket.close(); } catch {} }
      await new Promise(resolveClose => server.close(resolveClose));
      await release().catch(() => {});
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startCollector(configuration(process.argv.slice(2))).then(collector => {
    console.log(`RaceHub local server: http://127.0.0.1:${collector.port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => collector.close().then(() => process.exit(0)));
  }).catch(error => { console.error(error.code === 'ELOCKED' ? error.message : 'RaceHub could not start. Check the dependency install, ports, and local recording directory.'); process.exitCode = 1; });
}
