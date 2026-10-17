import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {F1TelemetryClient} from '@racehub-io/f1-telemetry-client';
import {createF1Adapter} from '../../../../server/adapters.mjs';
import {normalizeSession} from '../../../telemetry/data.ts';
import {channelSegments, deltaSegments, lapRows, nearestPoint, recordedChannels, samplePoints} from './analysis.ts';

const captures = [];
const measuredPoints = [];
for (const year of [2024, 2025]) {
  const adapter = createF1Adapter();
  const rows = [];
  const recording = await readFile(new URL(`../../../../tests/recordings/${year}.json`, import.meta.url), 'utf8');
  for (const line of recording.trim().split(/\r?\n/)) {
    const buffer = Buffer.from(JSON.parse(line).message.data);
    rows.push(...adapter(buffer).rows);
    const parsed = F1TelemetryClient.parseBufferMessage(buffer, true);
    if (parsed?.packetID === 'carTelemetry') {
      parsed.packetData.data.m_carTelemetryData.forEach((car, index) => {
        if (Number.isFinite(car.m_engineRPM)) measuredPoints.push({x: index, y: car.m_engineRPM});
      });
    }
  }
  captures.push(normalizeSession({rows, name: `F1 ${year} capture`}, 'f1'));
}

test('recorded rows stay with their exact lap and participant IDs', () => {
  assert.ok(captures.reduce((count, capture) => count + capture.rows.length, 0) > 0);
  for (const capture of captures) {
    for (const lap of capture.laps) {
      const selected = lapRows(capture.rows, lap);
      assert.ok(selected.length > 0);
      assert.ok(selected.every(row => row.lapId === lap.lapId && row.participantId === lap.participantId));
      assert.equal(lapRows(capture.rows, {...lap, participantId: 'absent-participant'}).length, 0);
    }
  }
});

test('single-frame captures do not become invented lap delta curves', () => {
  for (const capture of captures) {
    for (const lap of capture.laps) {
      const rows = lapRows(capture.rows, lap);
      if (rows.length < 2) assert.deepEqual(deltaSegments(rows, rows, 'distance'), []);
    }
  }
  assert.deepEqual(deltaSegments([], [], 'time'), []);
});

test('missing channels remain absent instead of becoming zero', () => {
  for (const capture of captures) {
    assert.deepEqual(channelSegments(capture.rows, 'distance', 'absent-channel'), []);
    for (const point of channelSegments(capture.rows, 'distance', 'speed').flat()) {
      assert.ok(capture.rows.some(row => row.lap_distance === point.x && row.speed === point.y));
    }
  }
  assert.deepEqual(channelSegments([{sessionTime: NaN, lap_distance: NaN, speed: NaN}], 'distance', 'speed'), []);
});

test('channel selection exposes finite recorded channels without identity metadata', () => {
  const rows = captures.flatMap(capture => capture.rows);
  const channels = recordedChannels(rows);
  assert.ok(channels.includes('speed'));
  assert.ok(!channels.includes('carIndex'));
  assert.ok(!channels.includes('sessionTime'));
  assert.ok(!channels.includes('participantId'));
  assert.ok(!channels.includes('absent-channel'));
  assert.ok(channels.every(key => rows.some(row => typeof row[key] === 'number' && Number.isFinite(row[key]))));
  assert.deepEqual(recordedChannels([]), []);
});

test('render decimation retains actual recorded samples and extrema', () => {
  assert.ok(measuredPoints.length > 12);
  const sampled = samplePoints(measuredPoints, 12);
  assert.ok(sampled.length <= 12);
  assert.equal(sampled[0], measuredPoints[0]);
  assert.equal(sampled[sampled.length - 1], measuredPoints[measuredPoints.length - 1]);
  assert.ok(sampled.every(point => measuredPoints.includes(point)));
  assert.equal(Math.min(...sampled.map(point => point.y)), Math.min(...measuredPoints.map(point => point.y)));
  assert.equal(Math.max(...sampled.map(point => point.y)), Math.max(...measuredPoints.map(point => point.y)));
});

test('cursor lookup does not extrapolate beyond recorded channel samples', () => {
  const points = captures.flatMap(capture => channelSegments(capture.rows, 'distance', 'speed').flat())
    .sort((left, right) => left.x - right.x);
  assert.ok(points.length > 0);
  assert.equal(nearestPoint(points, points[0].x - 1), undefined);
  assert.equal(nearestPoint(points, points[points.length - 1].x + 1), undefined);
  assert.ok(points.includes(nearestPoint(points, points[0].x)));
  assert.equal(nearestPoint([], 0), undefined);
});

test('private recorded lap segments preserve delta accuracy and overlap', {skip: !process.env.RACEHUB_REAL_RECORDING_PATH}, async () => {
  const capture = normalizeSession(JSON.parse(await readFile(process.env.RACEHUB_REAL_RECORDING_PATH, 'utf8')));
  const eligible = capture.laps.map(lap => lapRows(capture.rows, lap)).filter(rows => deltaSegments(rows, rows, 'distance').flat().length > 10);
  assert.ok(eligible.length > 1);
  eligible.forEach(rows => assert.ok(deltaSegments(rows, rows, 'distance').flat().every(point => point.y === 0)));
  const forward = eligible.map(rows => {
    let previousDistance = -Infinity;
    let previousTime = -Infinity;
    return rows.filter(row => {
      if (!Number.isFinite(row.lap_distance) || !Number.isFinite(row.lap_time) || row.lap_distance < 0 ||
        row.lap_distance <= previousDistance || row.lap_time < previousTime) return false;
      previousDistance = row.lap_distance;
      previousTime = row.lap_time;
      return true;
    });
  }).sort((left, right) => right.length - left.length);
  const reference = forward[0];
  const candidate = forward.slice(1).find(rows => deltaSegments(rows, reference, 'distance').flat().length > 10);
  assert.ok(candidate);
  const at = (rows, x) => {
    const index = rows.findIndex(row => row.lap_distance >= x);
    assert.ok(index >= 0 && x >= rows[0].lap_distance);
    const right = rows[index];
    if (right.lap_distance === x) return right.lap_time / 1000;
    const left = rows[index - 1];
    return ((right.lap_distance - x) * left.lap_time + (x - left.lap_distance) * right.lap_time) /
      (right.lap_distance - left.lap_distance) / 1000;
  };
  const delta = deltaSegments(candidate, reference, 'distance').flat();
  delta.forEach(point => assert.ok(Math.abs(point.y - (at(candidate, point.x) - at(reference, point.x))) < 1e-9));
  const partial = candidate.slice(Math.floor(candidate.length / 3), Math.ceil(candidate.length * 2 / 3));
  const partialDelta = deltaSegments(partial, reference, 'distance').flat();
  assert.ok(partialDelta.length > 1);
  assert.ok(partialDelta.every(point => point.x >= partial[0].lap_distance && point.x <= partial[partial.length - 1].lap_distance));
  const timeDelta = deltaSegments(candidate, reference, 'time').flat();
  assert.equal(timeDelta.length, delta.length);
  timeDelta.forEach((point, index) => assert.ok(Math.abs(point.x - at(reference, delta[index].x)) < 1e-9));
});
