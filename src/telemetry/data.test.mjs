import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createF1Adapter} from '../../server/adapters.mjs';
import {combineSessions, exportCsv, exportJson, normalizeSession, parseCsv, parseTelemetryFile} from './data.ts';

const documents = [];
for (const year of [2024, 2025]) {
  const records = (await readFile(new URL(`../../tests/recordings/${year}.json`, import.meta.url), 'utf8'))
    .trim().split('\n').map(line => JSON.parse(line));
  const telemetry = records.find(record => record.parsed.m_header.m_packetId === 6);
  const uid = telemetry.parsed.m_header.m_sessionUID;
  const adapter = createF1Adapter();
  const rows = [];
  for (const record of [...records.filter(record => record !== telemetry && record.parsed.m_header.m_sessionUID === uid), telemetry]) {
    rows.push(...adapter(Buffer.from(record.message.data)).rows);
  }
  documents.push(normalizeSession({rows, name: `F1 ${year} packet capture`}, 'f1').document);
}
const channels = ['sessionTime', 'lap_distance', 'lap_time', 'speed', 'throttle', 'brake', 'steer',
  'gear', 'engine_rpm', 'tyre_pressure_FL', 'tyre_surface_temperature_RL', 'lap_invalid'];
function equalMeasurements(actual, expected) {
  assert.equal(actual.rows.length, expected.rows.length);
  actual.rows.forEach((row, index) => {
    assert.equal(row.participantId, expected.rows[index].participantId);
    channels.forEach(channel => assert.ok(row[channel] === expected.rows[index][channel], channel));
  });
}

test('actual F1 channels survive JSON, CSV, NDJSON and gzip import', async () => {
  for (const document of documents) {
    const {rows, ...header} = document;
    const ndjson = [JSON.stringify(header), ...rows.map(row => JSON.stringify(row))].join('\n');
    for (const file of [new File([exportJson(document)], 'capture.json'),
      new File([exportCsv(rows)], 'capture.csv'), new File([ndjson], 'capture.ndjson'),
      new File([gzipSync(exportJson(document))], 'capture.rhc')]) {
      const imported = await parseTelemetryFile(file, 'f1');
      equalMeasurements(imported.document, document);
      assert.equal(imported.document.id, document.id);
      assert.equal(imported.document.trackName, document.trackName);
    }
  }
});

test('normalization keeps stable lap identities and does not mutate the input', () => {
  const document = documents[1];
  const original = exportJson(document);
  const first = normalizeSession(document);
  const second = normalizeSession(first.document);
  assert.deepEqual(second.document, first.document);
  assert.deepEqual(second.laps.map(lap => lap.lapId), first.laps.map(lap => lap.lapId));
  assert.equal(exportJson(document), original);
  assert.ok(first.laps.every(lap => !lap.isComplete));
});

test('separate imports from the same real capture can be compared without changing measurements', () => {
  const original = documents[1];
  const importedAgain = {...original, id: randomUUID(), name: 'Second import of the same capture',
    rows: original.rows.map(row => ({...row, session_id: undefined}))};
  const combined = combineSessions([original, importedAgain]);
  assert.equal(combined.rows.length, original.rows.length * 2);
  assert.equal(combined.participants.length, new Set(original.rows.map(row => row.participantId)).size * 2);
  combined.rows.forEach((row, index) => channels.forEach(channel =>
    assert.equal(row[channel], original.rows[index % original.rows.length][channel])));
  assert.throws(() => combineSessions([combined.document, original]), /already in the comparison/);
  assert.throws(() => combineSessions([original, original]), /already in the comparison/);
  assert.throws(() => combineSessions([documents[0], original]), /same game and track/);
});

test('invalid files and mixed games fail before use', async () => {
  const mixed = documents.flatMap(document => document.rows.map(({session_id, ...row}) => row));
  assert.throws(() => normalizeSession({rows: mixed}, 'f1'), /more than one session/);
  assert.throws(() => normalizeSession({...documents[0], version: 2}), /version/);
  assert.throws(() => normalizeSession({...documents[0], rows: []}), /no telemetry/);
  assert.throws(() => normalizeSession({...documents[0], rows: [{...documents[0].rows[0], sessionTime: Infinity}]}), /finite sessionTime/);
  assert.throws(() => normalizeSession({...documents[0], rows: [{...documents[0].rows[0], throttle: 2}]}), /0 to 1/);
  assert.throws(() => normalizeSession({...documents[0], rows: [{...documents[0].rows[0], simulator: 'iracing'}]}), /more than one game/);
  await assert.rejects(parseTelemetryFile(new File([], 'empty.json')), /empty/);
  await assert.rejects(parseTelemetryFile(new File(['not a telemetry file'], 'invalid.json')), /Use RaceHub/);
});

test('CSV rejects ambiguous fields and keeps spreadsheet formulas inert', () => {
  for (const content of ['a,a\n1,2', 'a,b\n1', 'a\n"unclosed', 'a\n"closed"extra', '__proto__\n1']) {
    assert.throws(() => parseCsv(content));
  }
  const csv = exportCsv(documents[0].rows.map(row => ({...row, participant_name: '=1+1'})));
  assert.ok(csv.includes("'=1+1"));
  assert.equal(parseCsv(csv)[0].participant_name, "'=1+1");
});
