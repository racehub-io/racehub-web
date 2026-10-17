import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {mkdtemp, readFile, rename, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {configuration, startCollector} from './index.mjs';
import {createNativeStorage, nativeBinary, startNativeCapture} from './native.mjs';

const binary = process.env.RACEHUB_NATIVE_BINARY && await nativeBinary(process.env.RACEHUB_NATIVE_BINARY);
if (process.env.RACEHUB_NATIVE_BINARY) assert.ok(binary, 'RACEHUB_NATIVE_BINARY must name an executable native collector.');

async function eventually(check) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await check()) return;
    await delay(20);
  }
  assert.fail('The native collector did not reach the expected state.');
}

test('real native capture survives stop, restart, and checked HTTP ranges', {skip: !binary, timeout: 20000}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'racehub-native-web-'));
  const options = configuration([], {RACEHUB_PORT: '0', RACEHUB_F1_PORT: '0', RACEHUB_IRACING_PORT: '0',
    RACEHUB_RFACTOR2_PORT: '0', RACEHUB_DATA_DIR: directory, RACEHUB_NATIVE_BINARY: binary});
  const sender = dgram.createSocket('udp4');
  let collector;
  try {
    collector = await startCollector(options);
    let base = `http://127.0.0.1:${collector.port}`;
    const api = async (path, value) => {
      const response = await fetch(base + path, value === undefined ? {} : {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value),
      });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    const started = await api('/api/recording/start', {simulator: 'f1', engine: 'native', scope: 'all', name: 'Recorded F1 24 packets'});
    assert.equal(started.engine, 'native');
    assert.equal(started.captureRate, 'source');
    const source = (await readFile(new URL('../tests/recordings/2024.json', import.meta.url), 'utf8'))
      .trim().split('\n').map(line => JSON.parse(line));
    const session = source.find(record => record.parsed.m_header.m_packetId === 6).parsed.m_header.m_sessionUID;
    const packets = source.filter(record => record.parsed.m_header.m_sessionUID === session)
      .sort((a, b) => a.parsed.m_header.m_sessionTime - b.parsed.m_header.m_sessionTime);
    for (const packet of packets) {
      const bytes = Buffer.from(packet.message.data ?? packet.message);
      await new Promise((resolve, reject) => sender.send(bytes, started.ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    }
    await eventually(() => collector.status().sampleCount > 0);
    assert.deepEqual((await api('/api/sessions')).sessions, []);
    const duplicate = await fetch(base + '/api/recording/start', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({simulator: 'f1', engine: 'native'})});
    assert.equal(duplicate.status, 409);
    const [stopped, again] = await Promise.all([api('/api/recording/stop', {}), api('/api/recording/stop', {})]);
    assert.ok(stopped.session.rowCount > 0);
    assert.equal(again.session, null);
    assert.equal(stopped.status.recording, false);
    const detail = await api(`/api/native/sessions/${stopped.session.id}`);
    assert.ok(detail.parts.length > 0);
    const part = detail.parts[0];
    const actual = await readFile(join(directory, 'native', detail.id, part.name));
    assert.equal(part.size, actual.length);
    const head = await fetch(base + part.url, {method: 'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(Number(head.headers.get('content-length')), actual.length);
    for (const [range, expected] of [['bytes=0-3', actual.subarray(0, 4)], ['bytes=-4', actual.subarray(-4)], ['bytes=4-', actual.subarray(4)]]) {
      const response = await fetch(base + part.url, {headers: {Range: range}});
      assert.equal(response.status, 206);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
    }
    for (const range of [`bytes=${actual.length}-`, 'bytes=-0', 'bytes=0-1,4-5']) {
      const response = await fetch(base + part.url, {headers: {Range: range}});
      assert.equal(response.status, 416);
      assert.equal(response.headers.get('content-range'), `bytes */${actual.length}`);
      await response.arrayBuffer();
    }
    assert.equal((await fetch(base + `/api/native/sessions/${detail.id}/parts/..%2Fsession.json`)).status, 400);
    assert.equal((await fetch(base + part.url, {headers: {Origin: 'https://untrusted.invalid'}})).status, 403);
    const storage = await createNativeStorage(directory);
    const manifestPath = join(directory, 'native', detail.id, 'session.json');
    const manifest = await readFile(manifestPath);
    try {
      await writeFile(manifestPath, 'null');
      assert.equal(await storage.get(detail.id), null);
      assert.deepEqual(await storage.list(), []);
    } finally { await writeFile(manifestPath, manifest); }
    if (process.platform !== 'win32') {
      const path = join(directory, 'native', detail.id, part.name);
      const outside = join(directory, part.name);
      await rename(path, outside);
      try {
        await symlink(outside, path);
        assert.equal(await storage.get(detail.id), null);
      } finally { await rm(path, {force: true}); await rename(outside, path); }
    }
    await collector.close();
    collector = await startCollector(options); base = `http://127.0.0.1:${collector.port}`;
    assert.equal((await api('/api/sessions')).sessions[0].id, detail.id);
    assert.deepEqual(await api(`/api/native/sessions/${detail.id}`), detail);
    const next = await api('/api/recording/start', {simulator: 'f1', engine: 'native'});
    assert.equal(next.recording, true);
    await collector.close(); collector = null;
    assert.equal((await (await createNativeStorage(directory)).list()).length, 1);
    const probe = dgram.createSocket('udp4');
    try { await new Promise((resolve, reject) => { probe.once('error', reject); probe.bind(next.ports.f1, '127.0.0.1', resolve); }); }
    finally { probe.close(); }
  } finally {
    sender.close(); await collector?.close(); await rm(directory, {recursive: true, force: true});
  }
});

test('native abort and failed startup release the child before return', {skip: !binary, timeout: 10000}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'racehub-native-abort-'));
  let capture;
  try {
    await assert.rejects(startNativeCapture(binary, {simulator: 'invalid', host: '127.0.0.1', port: 0,
      directory: join(directory, 'invalid'), id: '21b1d34b-fb38-4dd0-9a05-8c0b39556810', name: 'Invalid option', scope: 'all'}, () => {}), {status: 503});
    let ready;
    capture = await startNativeCapture(binary, {simulator: 'f1', host: '127.0.0.1', port: 0,
      directory: join(directory, 'valid'), id: 'fabd9602-e33b-43c5-adf5-79bb16474172', name: 'Empty capture', scope: 'all'}, event => { if (event.event === 'ready') ready = event; });
    await capture.abort();
    const probe = dgram.createSocket('udp4');
    try { await new Promise((resolve, reject) => { probe.once('error', reject); probe.bind(ready.port, '127.0.0.1', resolve); }); }
    finally { probe.close(); }
  } finally { await capture?.abort(); await rm(directory, {recursive: true, force: true}); }
});
