import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {join} from 'node:path';
import {parquetReadObjects} from 'hyparquet';
import {compressors} from 'hyparquet-compressors';
import {canonicalColumn, indexParquet, indexParquetParts, loadParquetLaps, parquetSession} from './parquet.ts';
import {channelRows, channelSegments} from '../components/Canvas/LineChartPanel/analysis.ts';

test('legacy Python column names map without losing wheel positions or timing units', () => {
  for (const [source, expected] of [
    ['m_header_m_sessionTime', 'sessionTime'],
    ['m_carTelemetryData_m_speed', 'speed'],
    ['m_lapData_m_currentLapTimeInMS', 'lap_time'],
    ['m_carMotionData_m_worldPositionX', 'world_x'],
    ['m_carTelemetryData_m_tyresPressureFL', 'tyre_pressure_FL'],
    ['m_carTelemetryData_m_tyresPressureRR', 'tyre_pressure_RR'],
    ['m_lapData_m_currentLapInvalid', 'lap_invalid'],
  ]) assert.equal(canonicalColumn(source), expected);
});

const legacyFixture = process.env.RACEHUB_REAL_LEGACY_PARQUET_PATH;
test('actual legacy Python F1 Parquet metadata and prefixed channels survive lazy loading', {skip: !legacyFixture}, async () => {
  const bytes = await readFile(legacyFixture);
  const recording = await indexParquet({blob: new Blob([bytes]), name: 'actual-legacy.pq'});
  assert.equal(recording.index.simulator, 'f1');
  const rows = await loadParquetLaps(recording, recording.index.laps.map(lap => lap.lapId));
  const raw = await parquetReadObjects({file: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), compressors});
  assert.equal(rows.length, raw.length);
  for (let index = 0; index < rows.length; index++) for (const [source, value] of Object.entries(raw[index])) {
    const channel = canonicalColumn(source);
    if ((typeof value === 'number' || typeof value === 'bigint') && Number.isFinite(Number(value))) assert.equal(rows[index][channel], Number(value));
  }
});

const sparseFixture = process.env.RACEHUB_REAL_SPARSE_PARQUET_PATH;
test('actual sparse packet families do not create unrelated channel or map gaps', {skip: !sparseFixture}, async () => {
  const bytes = await readFile(sparseFixture);
  const recording = await indexParquet({blob: new Blob([bytes]), name: 'actual-sparse.parquet'});
  const rows = await loadParquetLaps(recording, recording.index.laps.map(lap => lap.lapId));
  assert.ok(new Set(rows.map(row => row.packetId)).size > 1);
  const packets = (await readFile(new URL('../../tests/recordings/2024.json', import.meta.url), 'utf8')).trim().split('\n').map(JSON.parse);
  for (const row of rows) {
    const packet = packets.find(record => record.parsed.m_header.m_packetId === row.packetId && record.parsed.m_header.m_frameIdentifier === row.frameId && record.parsed.m_header.m_sessionUID === row.sessionId)?.parsed;
    assert.ok(packet, 'Every native sample must match an actual source packet and exact session UID.');
    assert.equal(row.sessionTime, packet.m_header.m_sessionTime);
    if (row.packetId === 6) {
      const car = packet.m_carTelemetryData[row.carIndex];
      assert.equal(row.speed, car.m_speed);
      assert.equal(row.throttle, car.m_throttle);
      assert.equal(row.brake, car.m_brake);
      assert.equal(row.engine_rpm, car.m_engineRPM);
    }
    if (row.packetId === 2) {
      const car = packet.m_lapData[row.carIndex];
      assert.equal(row.lap_time, car.m_currentLapTimeInMS);
      assert.equal(row.lap_distance, car.m_lapDistance);
      assert.equal(row.lap_source_time, packet.m_header.m_sessionTime);
    }
    if (row.packetId === 0) {
      const car = packet.m_carMotionData[row.carIndex];
      assert.equal(row.world_x, car.m_worldPositionX);
      assert.equal(row.world_z, car.m_worldPositionZ);
    }
  }
  for (const channel of ['speed', 'world_x']) {
    const measured = rows.filter(row => Number.isFinite(row[channel]));
    assert.ok(measured.length > 0);
    const families = new Set(measured.map(row => row.packetId));
    const filtered = channelRows(rows, channel);
    assert.ok(filtered.length < rows.length);
    assert.deepEqual(filtered, rows.filter(row => families.has(row.packetId)));
    assert.equal(filtered.filter(row => Number.isFinite(row[channel])).length, measured.length);
  }
  const points = channelSegments(rows, 'time', 'speed').flat();
  assert.equal(points.length, rows.filter(row => Number.isFinite(row.speed) && Number.isFinite(row.lap_time)).length);
});

test('empty, invalid and cancelled Parquet reads fail before indexing', async () => {
  await assert.rejects(indexParquet({blob: new Blob([]), name: 'empty.pq'}, 'f1'), /size/);
  await assert.rejects(indexParquet({blob: new Blob(['invalid parquet file']), name: 'invalid.pq'}, 'f1'), /footer/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(indexParquet({blob: new Blob([]), name: 'cancelled.pq'}, 'f1', {signal: controller.signal}), {name: 'AbortError'});
});

const fixture = process.env.RACEHUB_REAL_PARQUET_PATH;
const sessionDirectory = process.env.RACEHUB_REAL_PARQUET_SESSION_DIR;
test('actual native parts retain one recording and load a lap across part boundaries', {skip: !sessionDirectory}, async () => {
  const manifest = JSON.parse(await readFile(join(sessionDirectory, 'session.json'), 'utf8'));
  assert.ok(manifest.parts.length > 1);
  const files = await Promise.all(manifest.parts.map(async part => ({
    blob: new Blob([await readFile(join(sessionDirectory, part.name))]), name: part.name,
  })));
  const recording = await indexParquetParts({sources: files, metadata: manifest});
  assert.equal(recording.index.rowCount, manifest.rowCount);
  assert.equal(recording.sources.length, manifest.parts.length);
  const boundary = recording.index.parts[1].rowStart;
  const lap = recording.index.laps.find(item => item.rowStart < boundary && item.rowEnd > boundary);
  assert.ok(lap);
  const loaded = await loadParquetLaps(recording, [lap.lapId]);
  const raw = (await Promise.all(files.map(async file => parquetReadObjects({
    file: await file.blob.arrayBuffer(), compressors,
    columns: ['participantId', 'sessionTime', 'world_x', 'world_z'],
  })))).flat();
  const expected = raw.slice(lap.rowStart, lap.rowEnd).filter(row => row.participantId === lap.participantId);
  assert.equal(loaded.length, expected.length);
  for (let position = 0; position < loaded.length; position++) {
    for (const channel of ['sessionTime', 'world_x', 'world_z']) {
      const value = expected[position][channel];
      assert.equal(loaded[position][channel], typeof value === 'number' ? value : undefined);
    }
  }
  if (sparseFixture) {
    const other = {blob: new Blob([await readFile(sparseFixture)]), name: 'other-recording.parquet'};
    await assert.rejects(indexParquetParts({sources: [files[0], other]}), /same recording and game/);
  }
});

test('actual native Parquet laps load by file range and keep exact measured values', {skip: !fixture}, async () => {
  const bytes = await readFile(fixture);
  const source = {blob: new Blob([bytes]), name: 'actual-recording.parquet'};
  const recording = await indexParquet(source, 'f1');
  assert.ok(recording.index.rowCount > 0);
  assert.ok(recording.index.laps.length > 0);
  assert.equal(parquetSession(recording.index).rows.length, 0);
  assert.equal(Object.hasOwn(recording, 'rows'), false);
  const first = recording.index.laps[0];
  const rows = await loadParquetLaps(recording, [first.lapId]);
  assert.equal(rows.length, first.rowCount);
  assert.ok(rows.every(row => row.lapId === first.lapId && row.participantId === first.participantId));
  assert.ok(rows.some(row => ['speed', 'lap_distance', 'world_x'].some(channel => Number.isFinite(row[channel]))));
  assert.ok(bytes.length < 32 * 1024 * 1024);
  const raw = await parquetReadObjects({file: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), compressors});
  const expected = raw.slice(first.rowStart, first.rowEnd).filter(row => String(row.participantId) === first.participantId);
  assert.equal(expected.length, rows.length);
  for (let position = 0; position < rows.length; position++) {
    for (const channel of ['sessionTime', 'speed', 'throttle', 'brake', 'lap_distance', 'lap_time', 'world_x', 'world_z']) {
      const value = expected[position][channel];
      if ((typeof value === 'number' || typeof value === 'bigint') && Number.isFinite(Number(value))) assert.equal(rows[position][channel], Number(value));
      else assert.equal(rows[position][channel], undefined);
    }
  }
  let requests = 0;
  const server = createServer((request, response) => {
    if (request.url === '/no-range') { response.writeHead(200, {'Content-Length': bytes.length}).end(bytes); return; }
    const match = request.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
    if (!match) { response.writeHead(400).end(); return; }
    requests++;
    const start = Number(match[1]);
    const end = Number(match[2]) + 1;
    response.writeHead(206, {'Content-Range': `bytes ${start}-${end - 1}/${bytes.length}`, 'Content-Length': end - start});
    response.end(bytes.subarray(start, end));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/actual.parquet`;
    const remote = await indexParquet({url, size: bytes.length, name: source.name}, 'f1');
    const remoteLap = remote.index.laps.find(lap => lap.participantId === first.participantId && lap.lapNumber === first.lapNumber);
    assert.ok(remoteLap);
    const remoteRows = await loadParquetLaps(remote, [remoteLap.lapId]);
    assert.deepEqual(remoteRows, rows);
    assert.ok(requests > 1);
    await assert.rejects(indexParquet({url: `http://127.0.0.1:${server.address().port}/no-range`, size: bytes.length, name: source.name}, 'f1'), /requested Parquet byte range/);
  } finally { server.close(); await once(server, 'close'); }
});
