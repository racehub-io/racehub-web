import {createReadStream, createWriteStream} from 'node:fs';
import {open, mkdir, readFile, readdir, rename, stat, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

export const validId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const validRow = row => row && typeof row.participantId === 'string' && row.participantId.length <= 300 && typeof row.sessionTime === 'number' && Number.isFinite(row.sessionTime);
const maxReadRows = 500000;
const maxReadBytes = 128 * 1024 * 1024;
const summary = metadata => ({
  id: metadata.id, simulator: metadata.simulator, name: metadata.name,
  createdAt: metadata.createdAt, trackName: metadata.trackName,
  scope: metadata.scope ?? 'all', sampleHz: metadata.sampleHz ?? null,
  ...(metadata.trackLength > 0 ? {trackLength: metadata.trackLength} : {}),
  rowCount: metadata.rowCount, recovered: Boolean(metadata.recovered),
});

async function syncDirectory(directory) {
  let handle;
  try { handle = await open(directory, 'r'); await handle.sync(); }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes(error.code)) throw error; }
  finally { await handle?.close(); }
}

export async function createStorage(directory, limits) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  const files = id => ({metadata: join(directory, `${id}.meta.json`), rows: join(directory, `${id}.rows.ndjson`)});
  async function save(metadata) {
    const temporary = join(directory, `${metadata.id}.${randomUUID()}.tmp`);
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(metadata)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, files(metadata.id).metadata);
    await syncDirectory(directory);
  }
  async function metadataFor(id) {
    if (!validId(id)) return null;
    try {
      if ((await stat(files(id).metadata)).size > 16384) return null;
      const metadata = JSON.parse(await readFile(files(id).metadata, 'utf8'));
      if (metadata.id !== id || metadata.format !== 'racehub-telemetry' || metadata.version !== 1 || !['f1', 'iracing', 'rfactor2'].includes(metadata.simulator)) return null;
      return metadata;
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  }
  async function* rowsFor(id) {
    const stream = createReadStream(files(id).rows, {encoding: 'utf8'});
    const lines = createInterface({input: stream, crlfDelay: Infinity});
    try {
      let count = 0;
      for await (const line of lines) {
        if (++count > maxReadRows || line.length > 65536) throw new Error('The stored recording exceeds its limits.');
        try { const row = JSON.parse(line); if (validRow(row)) yield row; }
        catch (error) { if (!(error instanceof SyntaxError)) throw error; }
      }
    } finally { lines.close(); stream.destroy(); }
  }
  const recovered = [];
  for (const filename of await readdir(directory)) {
    if (!filename.endsWith('.meta.json')) continue;
    const id = filename.slice(0, -10);
    const metadata = await metadataFor(id);
    if (!metadata || metadata.state !== 'recording') continue;
    const info = await stat(files(id).rows).catch(() => null);
    if (!info || info.size > maxReadBytes) continue;
    let count = 0;
    for await (const row of rowsFor(id)) {
      count++; metadata.lastSampleAt = row.receivedAt;
      if (row.track_name) metadata.trackName = row.track_name;
      if (row.track_length > 0) metadata.trackLength = row.track_length;
    }
    metadata.state = 'complete'; metadata.recovered = true; metadata.rowCount = count;
    await save(metadata); recovered.push(summary(metadata));
  }
  return {
    recovered,
    async start(simulator, name, scope = 'player', sampleHz = 10) {
      const metadata = {
        format: 'racehub-telemetry', version: 1, id: randomUUID(), simulator, name,
        createdAt: new Date().toISOString(), trackName: '', scope, sampleHz, rowCount: 0, state: 'recording',
      };
      const handle = await open(files(metadata.id).rows, 'wx', 0o600);
      const stream = createWriteStream(files(metadata.id).rows, {fd: handle, autoClose: false, highWaterMark: 1024 * 1024});
      let streamError;
      stream.on('error', error => { streamError = error; });
      try { await save(metadata); }
      catch (error) { stream.destroy(); await handle.close(); throw error; }
      let bytes = 0;
      let finished = false;
      return {
        metadata,
        append(row) {
          if (finished || streamError) throw new Error('The recording file cannot accept more data.');
          if (!validRow(row)) throw new Error('Invalid normalized telemetry row.');
          const line = `${JSON.stringify(row)}\n`;
          const length = Buffer.byteLength(line);
          if (metadata.rowCount >= limits.maxRows || bytes + length > Math.min(limits.maxBytes, maxReadBytes - 16384)) throw new Error('The recording limit was reached. Start a new recording.');
          if (stream.writableLength > limits.maxPendingBytes) throw new Error('The disk cannot keep up with telemetry. Recording stopped.');
          if (length > 65536) throw new Error('A telemetry row exceeds the size limit.');
          stream.write(line); bytes += length; metadata.rowCount++;
          metadata.lastSampleAt = row.receivedAt;
          if (row.track_name) metadata.trackName = row.track_name;
          if (row.track_length > 0) metadata.trackLength = row.track_length;
        },
        async finish() {
          if (finished) return summary(metadata);
          finished = true;
          try {
            if (streamError) throw streamError;
            stream.end(); await once(stream, 'finish');
            await handle.sync();
            metadata.state = 'complete'; await save(metadata);
          } finally { stream.destroy(); await handle.close(); }
          return summary(metadata);
        },
        async abort() {
          if (finished) return;
          finished = true; stream.destroy(); await handle.close();
        },
      };
    },
    async list(activeId) {
      const sessions = [];
      for (const filename of await readdir(directory)) {
        if (!filename.endsWith('.meta.json')) continue;
        const id = filename.slice(0, -10);
        if (id === activeId) continue;
        const metadata = await metadataFor(id);
        if (metadata?.state === 'complete') sessions.push(summary(metadata));
      }
      return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(id) {
      const metadata = await metadataFor(id);
      if (metadata?.state !== 'complete') return null;
      const info = await stat(files(id).rows).catch(() => null);
      if (!info || info.size > maxReadBytes) return null;
      return {
        metadata: {
          format: metadata.format, version: metadata.version, id: metadata.id,
          simulator: metadata.simulator, name: metadata.name, createdAt: metadata.createdAt,
          scope: metadata.scope ?? 'all', sampleHz: metadata.sampleHz ?? null,
          trackName: metadata.trackName, ...(metadata.trackLength > 0 ? {trackLength: metadata.trackLength} : {}),
        },
        rows: () => rowsFor(id),
      };
    },
    async delete(id) {
      const metadata = await metadataFor(id);
      if (!metadata || metadata.state !== 'complete') return false;
      await unlink(files(id).metadata);
      await unlink(files(id).rows).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await syncDirectory(directory);
      return true;
    },
  };
}
