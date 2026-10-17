import {spawn} from 'node:child_process';
import {createReadStream, constants} from 'node:fs';
import {access, mkdir, readFile, readdir, realpath, rm, stat} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {validId} from './storage.mjs';

const error = (status, message) => Object.assign(new Error(message), {status});
const partName = name => typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(?:parquet|pq)$/.test(name);
const games = new Set(['f1', 'iracing', 'rfactor2']);

export async function nativeBinary(configured) {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const candidate = configured || fileURLToPath(new URL(`../../racehub-rust/target/release/aggregator${suffix}`, import.meta.url));
  try {
    if (!(await stat(candidate)).isFile()) return null;
    await access(candidate, constants.X_OK);
    return resolve(candidate);
  } catch { return null; }
}

export async function createNativeStorage(directory) {
  const root = join(directory, 'native');
  await mkdir(root, {recursive: true, mode: 0o700});
  const realRoot = await realpath(root);
  async function folder(id) {
    if (!validId(id)) throw error(400, 'Invalid native session ID.');
    const result = await realpath(join(root, id)).catch(() => null);
    if (!result || !result.startsWith(realRoot + sep) || dirname(result) !== realRoot) return null;
    return result;
  }
  async function get(id) {
    const path = await folder(id);
    if (!path) return null;
    const manifest = join(path, 'session.json');
    const manifestPath = await realpath(manifest).catch(() => null);
    if (!manifestPath || dirname(manifestPath) !== path) return null;
    const manifestInfo = await stat(manifestPath).catch(() => null);
    if (!manifestInfo?.isFile() || manifestInfo.size > 1024 * 1024) return null;
    let value;
    try { value = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { return null; }
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.id !== id || !games.has(value.simulator) || typeof value.name !== 'string' || value.name.length > 240 ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isSafeInteger(value.rowCount) || value.rowCount < 0 ||
      !Array.isArray(value.parts) || value.parts.length > 4096 || !value.parts.every(part => part && typeof part === 'object') ||
      new Set(value.parts.map(part => part.name)).size !== value.parts.length ||
      (value.scope !== undefined && !['player', 'all'].includes(value.scope))) return null;
    const parts = [];
    for (const part of value.parts) {
      if (!partName(part.name)) return null;
      const file = await realpath(join(path, part.name)).catch(() => null);
      if (!file || dirname(file) !== path) return null;
      const info = await stat(file).catch(() => null);
      if (!info?.isFile() || !Number.isSafeInteger(part.size) || part.size < 12 || part.size !== info.size) return null;
      parts.push({name: part.name, size: part.size, url: `/api/native/sessions/${id}/parts/${encodeURIComponent(part.name)}`});
    }
    return {storage: 'parquet', id, name: value.name, simulator: value.simulator,
      createdAt: value.createdAt, trackName: typeof value.trackName === 'string' ? value.trackName.slice(0, 240) : '',
      ...(Number.isFinite(value.trackLength) && value.trackLength > 0 ? {trackLength: value.trackLength} : {}),
      rowCount: value.rowCount, captureRate: 'source', scope: value.scope ?? 'player', parts};
  }
  return {
    get,
    async list(excludedId) {
      const sessions = [];
      for (const id of await readdir(root)) {
        if (!validId(id) || id === excludedId) continue;
        const session = await get(id);
        if (session?.rowCount) sessions.push({...session, parts: undefined});
      }
      return sessions;
    },
    async create(id) {
      if (!validId(id)) throw error(400, 'Invalid native session ID.');
      const path = join(root, id);
      await mkdir(path, {mode: 0o700});
      return path;
    },
    async delete(id) {
      if (!await get(id)) return false;
      await rm(await folder(id), {recursive: true});
      return true;
    },
    async serve(id, name, request, response) {
      if (!['GET', 'HEAD'].includes(request.method)) throw error(405, 'Use GET or HEAD for a recording part.');
      if (!partName(name)) throw error(400, 'Invalid recording part name.');
      const session = await get(id);
      const part = session?.parts.find(item => item.name === name);
      if (!part) throw error(404, 'Recording part not found.');
      let start = 0, end = part.size - 1;
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          response.writeHead(416, {'Content-Range': `bytes */${part.size}`}); response.end(); return;
        }
        if (!match[1]) { const length = Number(match[2]); start = Math.max(0, part.size - length); }
        else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        if (![start, end].every(Number.isSafeInteger) || start < 0 || start >= part.size || start > end || (!match[1] && Number(match[2]) === 0)) {
          response.writeHead(416, {'Content-Range': `bytes */${part.size}`}); response.end(); return;
        }
      }
      response.writeHead(range ? 206 : 200, {'Content-Type': 'application/vnd.apache.parquet',
        'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
        ...(range ? {'Content-Range': `bytes ${start}-${end}/${part.size}`} : {}),
        'Cache-Control': 'private, max-age=31536000, immutable', 'ETag': `"${id}-${name}-${part.size}"`});
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(join(await folder(id), name), {start, end});
      stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response);
    },
  };
}

export async function startNativeCapture(binary, options, onEvent) {
  const child = spawn(binary, ['capture', '--simulator', options.simulator, '--host', options.host,
    '--port', String(options.port), '--output-dir', options.directory, '--recording-id', options.id,
    '--name', options.name, '--scope', options.scope], {stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
  let readyResolve, readyReject, doneResolve, doneReject, exitedResolve;
  let ready = false, ended = false, stopping = false;
  let stderr = '';
  const started = new Promise((resolveReady, reject) => { readyResolve = resolveReady; readyReject = reject; });
  const done = new Promise((resolveDone, reject) => { doneResolve = resolveDone; doneReject = reject; });
  const exited = new Promise(resolveExit => { exitedResolve = resolveExit; });
  done.catch(() => {});
  async function terminate() {
    if (ended) return;
    child.kill();
    const killTimer = setTimeout(() => { if (!ended) child.kill('SIGKILL'); }, 2000);
    killTimer.unref();
    try { await exited; } finally { clearTimeout(killTimer); }
  }
  function ipcFailure() {
    const failure = error(503, 'The native collector sent an invalid status message. Its raw recording remains on disk.');
    readyReject(failure); doneReject(failure); child.kill();
  }
  const timer = setTimeout(() => { readyReject(error(503, 'The native collector did not start in time.')); }, 15000);
  timer.unref();
  let pending = 0;
  child.stdout.on('data', chunk => {
    pending += chunk.length;
    const newline = chunk.lastIndexOf(10);
    if (newline !== -1) pending = chunk.length - newline - 1;
    if (pending > 256 * 1024) ipcFailure();
  });
  const lines = createInterface({input: child.stdout});
  lines.on('line', line => {
    if (line.length > 256 * 1024) { ipcFailure(); return; }
    let event;
    try { event = JSON.parse(line); } catch { ipcFailure(); return; }
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.event !== 'string') { ipcFailure(); return; }
    if (event.event === 'ready') {
      if (ready || !Number.isInteger(event.port) || event.port < 1 || event.port > 65535 ||
        (options.port !== 0 && event.port !== options.port) ||
        event.id !== options.id || event.simulator !== options.simulator || event.scope !== options.scope) { ipcFailure(); return; }
      ready = true; clearTimeout(timer); readyResolve(event);
    }
    if (['ready', 'status', 'sample', 'complete', 'error'].includes(event.event)) {
      try { onEvent(event); } catch { ipcFailure(); }
    }
  });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8192); });
  child.stdout.on('error', ipcFailure); child.stderr.on('error', ipcFailure);
  child.stdin.on('error', () => {});
  child.on('error', () => {
    clearTimeout(timer); readyReject(error(503, 'The native collector could not start. Check its build and path.'));
    doneReject(error(503, 'The native collector could not start.'));
  });
  child.on('close', code => {
    ended = true; clearTimeout(timer); lines.close();
    exitedResolve();
    if (!ready) readyReject(error(503, 'The native collector stopped before it opened the UDP port.'));
    if (code !== 0) doneReject(error(500, stderr.includes('unsupported') || stderr.includes('Unsupported')
      ? 'The native collector rejected this game format. Native F1 capture supports F1 24.'
      : 'The native collector stopped with an error. Its raw recording remains on disk.'));
    else doneResolve();
  });
  try { await started; }
  catch (failure) { await terminate(); throw failure; }
  return {
    done,
    async stop() {
      if (!ended && !stopping) { stopping = true; child.stdin.end('stop\n'); }
      let stopTimer;
      try {
        await Promise.race([done, new Promise((_, reject) => { stopTimer = setTimeout(() => {
          reject(error(504, 'The native collector did not finish. Its raw recording remains on disk.'));
        }, 60000); stopTimer.unref(); })]);
      } catch (failure) {
        await terminate(); throw failure;
      } finally { clearTimeout(stopTimer); }
    },
    abort: terminate,
  };
}
