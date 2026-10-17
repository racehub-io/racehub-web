import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, readdir, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import dgram from 'node:dgram';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createAdapters} from './adapters.mjs';
import {configuration, startCollector} from './index.mjs';
import {parseTelemetryFile} from '../src/telemetry/data.ts';

async function capture(year) {
  const text = await readFile(new URL(`../tests/recordings/${year}.json`, import.meta.url), 'utf8');
  const records = text.trim().split('\n').map(line => JSON.parse(line));
  const telemetry = records.find(record => record.parsed.m_header.m_packetId === 6);
  const uid = telemetry.parsed.m_header.m_sessionUID;
  const sameSession = records.filter(record => record.parsed.m_header.m_sessionUID === uid && record !== telemetry);
  return {telemetry, records: [...sameSession, telemetry]};
}
const bytes = record => Buffer.from(record.message.data ?? record.message);
async function eventually(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await check(); if (result) return result;
    await delay(20);
  }
  assert.fail('The local collector did not reach the expected state.');
}

test('the recorded F1 24 and F1 25 packets produce the recorded driver channels', async () => {
  for (const year of [2024, 2025]) {
    const adapters = await createAdapters();
    const {records, telemetry} = await capture(year);
    let packet;
    for (const record of records) packet = adapters.f1(bytes(record));
    const player = telemetry.parsed.m_header.m_playerCarIndex;
    const participants = records.find(record => record.parsed.m_header.m_packetId === 4).parsed;
    assert.equal(packet.rows.length, participants.m_numActiveCars);
    let measured = 0;
    for (const row of packet.rows) {
      const index = row.carIndex;
      const visible = index === player || participants.m_participants[index].m_yourTelemetry !== 0;
      if (visible) {
        assert.equal(row.speed, telemetry.parsed.m_carTelemetryData[index].m_speed);
        assert.equal(row.engine_rpm, telemetry.parsed.m_carTelemetryData[index].m_engineRPM);
        measured++;
      } else {
        assert.equal(Object.hasOwn(row, 'speed'), false);
        assert.equal(Object.hasOwn(row, 'engine_rpm'), false);
      }
      assert.equal(row.sessionTime, telemetry.parsed.m_header.m_sessionTime);
      assert.equal(row.simulator, 'f1');
      assert.ok(row.participantId);
    }
    assert.ok(measured > 0);
  }
});

test('empty and wrong-game datagrams are rejected', async () => {
  const adapters = await createAdapters();
  for (const adapter of Object.values(adapters)) assert.throws(() => adapter(Buffer.alloc(0)));
  const {telemetry} = await capture(2024);
  assert.throws(() => adapters.iracing(bytes(telemetry)));
  assert.throws(() => adapters.rfactor2(bytes(telemetry)));
  assert.throws(() => adapters.f1(bytes(telemetry).subarray(0, 30)));
});

test('actual UDP packets survive a durable stop and a server restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'racehub-real-recording-'));
  const options = configuration([], {RACEHUB_PORT: '0', RACEHUB_F1_PORT: '0', RACEHUB_IRACING_PORT: '0', RACEHUB_RFACTOR2_PORT: '0', RACEHUB_DATA_DIR: directory});
  let collector;
  let eventReader;
  let eventRequest;
  let eventTask;
  const events = [];
  const socket = dgram.createSocket('udp4');
  try {
    collector = await startCollector(options);
    let url = `http://127.0.0.1:${collector.port}`;
    const api = async (path, value) => {
      const response = await fetch(url + path, value === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)});
      assert.equal(response.status, 200); return response.json();
    };
    assert.equal((await fetch(url + '/api/status', {headers: {Origin: 'https://untrusted.invalid'}})).status, 403);
    const badHostStatus = await new Promise((resolve, reject) => {
      http.get(url + '/api/status', {headers: {Host: 'untrusted.invalid'}}, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    assert.equal(badHostStatus, 403);
    const oversized = await new Promise((resolve, reject) => {
      const request = http.request(url + '/api/recording/start', {method: 'POST', headers: {'Content-Type': 'application/json'}}, response => {
        let body = '';
        response.setEncoding('utf8').on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({status: response.statusCode, body: JSON.parse(body)}));
      }).on('error', reject);
      request.write('{'); request.end(' '.repeat(5000));
    });
    assert.equal(oversized.status, 413); assert.equal(typeof oversized.body.error, 'string');
    assert.equal((await fetch(url + '/api/recording/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '[]'})).status, 400);
    assert.equal((await fetch(url + '/api/sessions/not-a-session')).status, 400);
    eventRequest = new AbortController();
    const eventResponse = await fetch(url + '/api/events', {signal: eventRequest.signal});
    assert.equal(eventResponse.headers.get('content-type'), 'text/event-stream');
    eventReader = eventResponse.body.getReader();
    eventTask = (async () => {
      let pending = '';
      const decoder = new TextDecoder();
      while (true) {
        const {value, done} = await eventReader.read();
        if (done) break;
        pending += decoder.decode(value, {stream: true});
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) !== -1) {
          const message = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
          const event = message.match(/^event: (.+)$/m)?.[1];
          const data = message.match(/^data: (.+)$/m)?.[1];
          if (event && data) events.push({event, data: JSON.parse(data)});
        }
      }
    })().catch(error => { if (error.name !== 'AbortError') throw error; });
    assert.equal((await fetch(url + '/api/recording/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({simulator: 'f1', sampleHz: 61})})).status, 400);
    assert.equal((await fetch(url + '/api/recording/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({simulator: 'f1', scope: 'spectator'})})).status, 400);
    const started = await api('/api/recording/start', {simulator: 'f1', name: 'Recorded F1 24 packets', scope: 'all', sampleHz: 10});
    assert.equal(started.recording, true);
    assert.equal(started.scope, 'all'); assert.equal(started.sampleHz, 10);
    const {records, telemetry} = await capture(2024);
    for (const record of records) await new Promise((resolve, reject) => socket.send(bytes(record), collector.status().ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    await eventually(() => collector.status().sampleCount > 0);
    let second;
    try { await assert.rejects(async () => { second = await startCollector(options); }, {code: 'ELOCKED'}); }
    finally { await second?.close(); }
    assert.equal(collector.status().recording, true);
    assert.equal((await api('/api/sessions')).sessions.length, 0);
    const failedDirectory = await mkdtemp(join(tmpdir(), 'racehub-bind-failure-'));
    try {
      await assert.rejects(startCollector({...options, directory: failedDirectory, port: collector.port}), {code: 'EADDRINUSE'});
      const afterFailure = await startCollector({...options, directory: failedDirectory});
      await afterFailure.close();
    } finally { await rm(failedDirectory, {recursive: true, force: true}); }
    const stopped = await api('/api/recording/stop', {});
    assert.equal(stopped.status.recording, false);
    assert.ok(stopped.session.rowCount > 0);
    const document = await api(`/api/sessions/${stopped.session.id}`);
    assert.equal(document.format, 'racehub-telemetry');
    assert.equal(document.version, 1);
    assert.equal(document.simulator, 'f1');
    assert.equal(document.scope, 'all'); assert.equal(document.sampleHz, 10);
    assert.equal(document.rows.length, stopped.session.rowCount);
    await eventually(() => events.some(event => event.event === 'session'));
    assert.deepEqual(events.filter(event => event.event === 'sample').flatMap(event => event.data), document.rows);
    assert.equal(events.find(event => event.event === 'session').data.id, document.id);
    const imported = await parseTelemetryFile(new File([JSON.stringify(document)], `${document.id}.json`, {type: 'application/json'}));
    assert.equal(imported.document.id, document.id);
    assert.equal(imported.rows.length, document.rows.length);
    assert.equal(imported.participants.length, new Set(document.rows.map(row => row.participantId)).size);
    const player = telemetry.parsed.m_header.m_playerCarIndex;
    assert.equal(document.rows.find(row => row.carIndex === player).speed, telemetry.parsed.m_carTelemetryData[player].m_speed);
    assert.equal((await api('/api/sessions')).sessions.length, 1);
    eventRequest.abort(); await eventTask;
    await collector.close();
    collector = await startCollector(options); url = `http://127.0.0.1:${collector.port}`;
    assert.deepEqual(await api(`/api/sessions/${stopped.session.id}`), document);
    assert.equal((await fetch(url + `/api/sessions/${stopped.session.id}`, {method: 'DELETE'})).status, 200);
    assert.equal((await api('/api/sessions')).sessions.length, 0);
    const playerStart = await api('/api/recording/start', {simulator: 'f1'});
    assert.equal(playerStart.scope, 'player'); assert.equal(playerStart.sampleHz, 10);
    for (const record of [...records, telemetry, telemetry]) await new Promise((resolve, reject) => socket.send(bytes(record), collector.status().ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    await eventually(() => collector.status().sampleCount > 0);
    const playerStop = await api('/api/recording/stop', {});
    const playerDocument = await api(`/api/sessions/${playerStop.session.id}`);
    assert.equal(playerDocument.rows.length, 1);
    assert.equal(playerDocument.rows[0].carIndex, player);
    assert.equal(playerDocument.rows[0].speed, telemetry.parsed.m_carTelemetryData[player].m_speed);
    assert.equal((await fetch(url + `/api/sessions/${playerStop.session.id}`, {method: 'DELETE'})).status, 200);
    const spectator = await capture(2025);
    await api('/api/recording/start', {simulator: 'f1'});
    for (const record of spectator.records) await new Promise((resolve, reject) => socket.send(bytes(record), collector.status().ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    await eventually(() => collector.status().error?.includes('player is not identified'));
    assert.equal(collector.status().sampleCount, 0);
    assert.equal((await api('/api/recording/stop', {})).session, null);
    assert.equal((await api('/api/sessions')).sessions.length, 0);
    await api('/api/recording/start', {simulator: 'f1', scope: 'all', sampleHz: 5});
    for (const record of spectator.records) await new Promise((resolve, reject) => socket.send(bytes(record), collector.status().ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    await eventually(() => collector.status().sampleCount > 0);
    const spectatorStop = await api('/api/recording/stop', {});
    const spectatorDocument = await api(`/api/sessions/${spectatorStop.session.id}`);
    assert.equal(spectatorDocument.rows.length, 7);
    assert.equal(spectatorDocument.rows.find(row => row.carIndex === 6).speed, spectator.telemetry.parsed.m_carTelemetryData[6].m_speed);
    await collector.close();
    collector = await startCollector({...options, limits: {...options.limits, maxRows: 1, maxBytes: 4096}});
    url = `http://127.0.0.1:${collector.port}`;
    assert.deepEqual(await api(`/api/sessions/${spectatorDocument.id}`), spectatorDocument);
    await api('/api/recording/start', {simulator: 'f1', scope: 'all'});
    for (const record of records) await new Promise((resolve, reject) => socket.send(bytes(record), collector.status().ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    await eventually(() => !collector.status().recording);
    assert.match(collector.status().error, /recording limit/);
    const limited = (await api('/api/sessions')).sessions.find(session => session.rowCount === 1);
    assert.ok(limited);
    assert.equal((await api(`/api/sessions/${limited.id}`)).rows.length, 1);
  } finally {
    eventRequest?.abort(); await eventTask;
    try { socket.close(); } catch {}
    await collector?.close(); await rm(directory, {recursive: true, force: true});
  }
});

test('a stale crash lock permits recovery of actual recorded packets', {timeout: 45000}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'racehub-crash-recovery-'));
  const options = configuration([], {RACEHUB_PORT: '0', RACEHUB_F1_PORT: '0', RACEHUB_IRACING_PORT: '0', RACEHUB_RFACTOR2_PORT: '0', RACEHUB_DATA_DIR: directory});
  const child = spawn(process.execPath, ['server/index.mjs', '--port', '0', '--f1-port', '0', '--iracing-port', '0', '--rfactor2-port', '0', '--data-dir', directory],
    {cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'ignore']});
  const socket = dgram.createSocket('udp4');
  let recovered;
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The child collector did not start.')), 5000);
      child.once('error', reject);
      child.once('exit', () => reject(new Error('The child collector stopped before it was ready.')));
      child.stdout.on('data', chunk => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    const start = await fetch(url + '/api/recording/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({simulator: 'f1'})});
    assert.equal(start.status, 200);
    const status = await start.json();
    const {records, telemetry} = await capture(2024);
    for (const record of records) await new Promise((resolve, reject) => socket.send(bytes(record), status.ports.f1, '127.0.0.1', error => error ? reject(error) : resolve()));
    await eventually(async () => {
      const filename = (await readdir(directory)).find(name => name.endsWith('.rows.ndjson'));
      return filename && (await stat(join(directory, filename))).size > 0;
    });
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
    await assert.rejects(startCollector(options), {code: 'ELOCKED'});
    await delay(32000);
    recovered = await startCollector(options);
    const base = `http://127.0.0.1:${recovered.port}`;
    const sessions = (await (await fetch(base + '/api/sessions')).json()).sessions;
    assert.equal(sessions.length, 1); assert.equal(sessions[0].recovered, true);
    const document = await (await fetch(base + `/api/sessions/${sessions[0].id}`)).json();
    const player = telemetry.parsed.m_header.m_playerCarIndex;
    assert.equal(document.rows.length, 1);
    assert.equal(document.rows[0].carIndex, player);
    assert.equal(document.rows[0].engine_rpm, telemetry.parsed.m_carTelemetryData[player].m_engineRPM);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; }
    try { socket.close(); } catch {}
    await recovered?.close(); await rm(directory, {recursive: true, force: true});
  }
});
