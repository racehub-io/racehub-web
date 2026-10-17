import { parquetMetadataAsync, parquetReadObjects } from "hyparquet";
import type { AsyncBuffer, Compressors, FileMetaData } from "hyparquet";
import { compressors, decompressZstd } from "hyparquet-compressors";
import { normalizeRow } from "./data.ts";
import type { LocalSession, Simulator, TelemetryRow } from "./data";
import type { Lap, Participant } from "../types";
import { browserOnly } from "../runtime.ts";

export type ParquetSource = { blob: Blob; name: string } | { url: string; size: number; name: string };
export interface NativeParquetDescriptor {
  storage?: "parquet";
  id: string;
  name: string;
  simulator: Simulator;
  createdAt: string;
  trackName: string;
  trackLength?: number;
  parts: Array<{ url: string; size: number; name: string }>;
}
export interface ParquetLap extends Lap { rowStart: number; rowEnd: number }
export interface ParquetIndex {
  id: string;
  name: string;
  simulator: Simulator;
  createdAt: string;
  trackName: string;
  trackLength?: number;
  rowCount: number;
  columns: string[];
  laps: ParquetLap[];
  participants: Participant[];
  parts: Array<{ rowStart: number; rowCount: number }>;
}
export interface ParquetRecording { storage: "parquet"; sources: ParquetSource[]; index: ParquetIndex }
export interface ReadOptions { signal?: AbortSignal; onProgress?: (message: string) => void }
type Values = Record<string, unknown>;
const MAX_BATCH_BYTES = 32 * 1024 * 1024;
const MAX_BATCH_ROWS = 131_072;
const MAX_SELECTED_ROWS = 500_000;
const MAX_SELECTED_BYTES = 64 * 1024 * 1024;
const MAX_INDEX_LAPS = 100_000;
const boundedCompressors: Compressors = Object.fromEntries(Object.entries(compressors).map(([codec, decode]) => [codec, (input: Uint8Array, length: number) => {
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BATCH_BYTES) throw new Error("A Parquet page exceeds the 32 MiB batch limit.");
  const result = codec === "ZSTD" ? decompressZstd(input, new Uint8Array(length)) : decode(input, length);
  if (result.byteLength !== length) throw new Error("The decoded Parquet page size is invalid.");
  return result;
}]));
const aliases: Record<string, string> = {
  m_header_m_sessionTime: "sessionTime", header_m_sessionTime: "sessionTime",
  m_header_m_frameIdentifier: "frameId", header_m_frameIdentifier: "frameId",
  m_header_m_sessionUID: "source_session_id", header_m_sessionUID: "source_session_id",
  car_idx: "carIndex", session_time_elapsed: "sessionTime",
};
const fields: Record<string, string> = {
  m_speed: "speed", m_throttle: "throttle", m_brake: "brake", m_steer: "steer",
  m_gear: "gear", m_engineRPM: "engine_rpm", m_clutch: "clutch", m_drs: "drs",
  m_currentLapTimeInMS: "lap_time", m_lastLapTimeInMS: "last_lap_time",
  m_lapDistance: "lap_distance", m_currentLapNum: "lap_number", m_currentLapInvalid: "lap_invalid",
  m_worldPositionX: "world_x", m_worldPositionY: "world_y", m_worldPositionZ: "world_z",
  m_gForceLateral: "g_lateral", m_gForceLongitudinal: "g_longitudinal", m_gForceVertical: "g_vertical",
  m_engineTemperature: "engine_temperature", m_fuelInTank: "fuel_in_tank", m_fuelCapacity: "fuel_capacity",
};
const wheelFields: Record<string, string> = {
  m_brakesTemperature: "brake_temperature", m_tyresSurfaceTemperature: "tyre_surface_temperature",
  m_tyresInnerTemperature: "tyre_inner_temperature", m_tyresPressure: "tyre_pressure",
  m_tyresWear: "tyre_wear", m_tyresDamage: "tyre_damage",
};
const indexChannels = new Set(["participantId", "participant_id", "carIndex", "CarIdx", "mID", "sessionTime",
  "session_time", "SessionTime", "lap_number", "Lap", "mLapNumber", "lap_time", "current_lap_time",
  "LapCurrentLapTime", "last_lap_time", "previous_lap_time", "lap_distance", "LapDist", "lap_invalid", "lap_valid", "lap_source_time",
  "session_id", "uniqueSessionID", "uniqueSessionId", "sessionId", "source_session_id"]);
const object = (value: unknown): value is Values => value !== null && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): number | undefined => value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : undefined;
const text = (value: unknown, fallback = "") => typeof value === "string" || typeof value === "number" || typeof value === "bigint" ? String(value).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 240) || fallback : fallback;
function stopped(options: ReadOptions) { options.signal?.throwIfAborted(); }

export function canonicalColumn(column: string): string {
  if (aliases[column]) return aliases[column];
  const field = column.replace(/^(?:m_carTelemetryData_|m_lapData_|m_carMotionData_|m_carStatusData_|m_carDamageData_|telemetry_|lap_|motion_)(?=m_)/, "");
  if (fields[field]) return fields[field];
  for (const [source, destination] of Object.entries(wheelFields)) {
    if (field.startsWith(source) && /^(FL|FR|RL|RR)$/.test(field.slice(source.length))) return `${destination}_${field.slice(source.length)}`;
  }
  return column;
}

async function bufferFor(source: ParquetSource, options: ReadOptions): Promise<AsyncBuffer> {
  stopped(options);
  const size = "blob" in source ? source.blob.size : source.size;
  if (!Number.isSafeInteger(size) || size < 12) throw new Error("The Parquet file size is invalid.");
  return { byteLength: size, async slice(start, end = size) {
    stopped(options);
    if (start < 0 || end > size || end < start || end - start > MAX_BATCH_BYTES) throw new Error("A Parquet read exceeds the 32 MiB batch limit. Split the file into smaller row groups.");
    if ("blob" in source) return source.blob.slice(start, end).arrayBuffer();
    if (browserOnly) throw new Error("Import the original Parquet files to use this recording on GitHub Pages. Recorder file links need the local app.");
    const base = typeof location === "undefined" ? source.url : location.href;
    const url = new URL(source.url, base);
    if (typeof location !== "undefined" && url.origin !== location.origin) throw new Error("Parquet files must use the local recorder origin.");
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` }, signal: options.signal });
    if (response.status !== 206 || response.headers.get("Content-Range") !== `bytes ${start}-${end - 1}/${size}` || Number(response.headers.get("Content-Length")) !== end - start) {
      await response.body?.cancel();
      throw new Error("The recorder must return the requested Parquet byte range.");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== end - start) throw new Error("The Parquet byte range is incomplete.");
    return bytes;
  } };
}

async function metadataFor(source: ParquetSource, options: ReadOptions) {
  const file = await bufferFor(source, options);
  const metadata = await parquetMetadataAsync(file);
  if (metadata.schema.length > 512 || metadata.row_groups.length > 100_000 || !Number.isSafeInteger(Number(metadata.num_rows)) || metadata.num_rows < 0) throw new Error("The Parquet schema or row count is invalid.");
  const columns = metadata.schema.filter(field => !field.num_children).map(field => field.name);
  if (columns.length !== metadata.schema.length - 1) throw new Error("Nested Parquet columns are not supported. Use flat telemetry columns.");
  const value = metadata.key_value_metadata?.find(entry => entry.key === "racehub")?.value;
  let header: Values = {};
  if (value) {
    if (value.length > 1024 * 1024) throw new Error("The RaceHub Parquet metadata is too large.");
    try { const parsed: unknown = JSON.parse(value); if (!object(parsed)) throw new Error(); header = parsed; }
    catch { throw new Error("The RaceHub Parquet metadata is invalid."); }
  }
  return { file, metadata, columns, header };
}

function groups(metadata: FileMetaData, columns: string[]) {
  let offset = 0;
  const ranges = metadata.row_groups.map(group => {
    const rowStart = offset;
    const count = Number(group.num_rows);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_BATCH_ROWS) throw new Error("A Parquet row group exceeds 131,072 rows. Split it into smaller row groups.");
    let bytes = 0;
    for (const column of group.columns) {
      const data = column.meta_data;
      if (!data || !columns.includes(data.path_in_schema.join("."))) continue;
      const size = Number(data.total_uncompressed_size);
      if (!Number.isSafeInteger(size) || size < 0) throw new Error("The Parquet column size is invalid.");
      bytes += size;
    }
    if (!Number.isSafeInteger(bytes) || bytes > MAX_BATCH_BYTES) throw new Error("Selected Parquet columns exceed the 32 MiB batch limit. Split the row groups.");
    offset += count;
    return { rowStart, rowEnd: offset };
  });
  if (offset !== Number(metadata.num_rows)) throw new Error("The Parquet row group counts do not match its row count.");
  return ranges;
}

function rowValues(raw: Values, header: Values, simulator: Simulator): Values {
  const result: Values = {};
  for (const [key, value] of Object.entries(raw)) result[canonicalColumn(key)] = value;
  if (result.participantId === undefined && result.participant_id === undefined && result.carIndex === undefined) {
    result.participantId = header.participantId ?? header.car_index ?? header.driver_number ?? header.player_name ?? header.driver_name;
  }
  if (result.source_session_id !== undefined) result.source_session_id = text(result.source_session_id);
  if (simulator === "iracing" && result.lap_time !== undefined && raw.session_time_elapsed !== undefined) result.lap_time = Number(result.lap_time) * 1000;
  return result;
}

export async function indexParquet(source: ParquetSource, simulator?: Simulator, options: ReadOptions = {}): Promise<ParquetRecording> {
  return indexParquetParts({ sources: [source], simulator }, options);
}

export async function indexParquetParts(input: { sources: ParquetSource[]; simulator?: Simulator; metadata?: Partial<NativeParquetDescriptor> }, options: ReadOptions = {}): Promise<ParquetRecording> {
  if (!input.sources.length || input.sources.length > 10_000) throw new Error("Select between 1 and 10,000 Parquet parts.");
  const first = await metadataFor(input.sources[0], options);
  const header: Values = { ...first.header, ...input.metadata };
  if (header.format !== undefined && header.format !== "racehub-telemetry" || header.version !== undefined && header.version !== 1) throw new Error("This RaceHub Parquet metadata version is not supported.");
  const recorder = number(header.recorder_type);
  const simulator = header.simulator ?? (recorder && [1, 2, 3].includes(recorder) ? "f1" : recorder === 4 ? "iracing" : input.simulator);
  if (simulator !== "f1" && simulator !== "iracing" && simulator !== "rfactor2") throw new Error("Select the game for this Parquet file.");
  const id = text(header.id, crypto.randomUUID());
  const createdAt = text(header.createdAt, new Date().toISOString());
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("The recording date is invalid.");
  const index: ParquetIndex = { id, name: text(header.name, input.sources[0].name.replace(/\.(?:pq|parquet)$/i, "")),
    simulator, createdAt, trackName: text(header.trackName ?? header.track_name), trackLength: number(header.trackLength ?? header.track_length),
    rowCount: 0, columns: [], laps: [], participants: [], parts: [] };
  const participants = new Map<string, Participant>();
  const active = new Map<string, { lap: ParquetLap; first: TelemetryRow; last: TelemetryRow; sequence: number }>();
  const columns = new Set<string>();
  const identities = new Set<string>();
  for (let part = 0; part < input.sources.length; part++) {
    stopped(options);
    const opened = part === 0 ? first : await metadataFor(input.sources[part], options);
    if (opened.header.simulator !== undefined && opened.header.simulator !== simulator || opened.header.id !== undefined && text(opened.header.id) !== id) throw new Error("The Parquet parts do not belong to the same recording and game.");
    if (simulator === "iracing" && opened.columns.includes("session_time_elapsed")) throw new Error("This legacy iRacing Parquet schema does not declare speed and control units. Use a native RaceHub recording.");
    const selected = opened.columns.filter(column => indexChannels.has(canonicalColumn(column)));
    if (!selected.some(column => ["sessionTime", "session_time", "SessionTime"].includes(canonicalColumn(column)))) throw new Error("The Parquet file has no supported session time column.");
    opened.columns.forEach(column => columns.add(canonicalColumn(column)));
    const partStart = index.rowCount;
    index.parts.push({ rowStart: partStart, rowCount: Number(opened.metadata.num_rows) });
    for (const group of groups(opened.metadata, selected)) {
      stopped(options);
      options.onProgress?.(`Indexing part ${part + 1}/${input.sources.length}: ${partStart + group.rowStart} samples`);
      const rows = await parquetReadObjects({ file: opened.file, metadata: opened.metadata, compressors: boundedCompressors, columns: selected, ...group });
      for (let position = 0; position < rows.length; position++) {
        const physical = partStart + group.rowStart + position;
        const values = rowValues(rows[position], opened.header, simulator);
        const identity = text(values.session_id ?? values.uniqueSessionID ?? values.uniqueSessionId ?? values.sessionId ?? values.source_session_id);
        if (identity) identities.add(identity);
        if (identities.size > 1) throw new Error("The Parquet recording contains more than one session. Import each session separately.");
        const row = normalizeRow(values, simulator, physical);
        const participantId = row.participantId;
        let participant = participants.get(participantId);
        if (!participant) {
          if (participants.size >= 256) throw new Error("The Parquet recording has too many driver identities.");
          participant = { participantId, name: text(opened.header.player_name ?? opened.header.driver_name ?? opened.header.participant_name, participantId),
            firstName: "", lastName: "", abbreviation: "", nationality: "", teamName: "", raceNumber: 0, isAi: false, isPlayer: false,
            lapIds: [], sessionId: 0, storagePath: "", uniqueSessionId: id };
          participants.set(participantId, participant);
        }
        const previous = active.get(participantId);
        const boundary = previous && (row.lap_number !== previous.last.lap_number || row.sessionTime < previous.last.sessionTime ||
          (row.lap_number === undefined && row.lap_time !== undefined && previous.last.lap_time !== undefined && row.lap_time + 1000 < previous.last.lap_time));
        if (!previous || boundary) {
          if (previous) {
            const consecutive = row.sessionTime > previous.last.sessionTime && (previous.first.lap_number === undefined || row.lap_number === Number(previous.first.lap_number) + 1);
            const startsNearLine = previous.first.lap_distance !== undefined && previous.first.lap_distance >= -50 && previous.first.lap_distance <= Math.max(50, (index.trackLength || 0) * 0.02) || previous.first.lap_time !== undefined && previous.first.lap_time <= 2000;
            const finishTime = number(row.last_lap_time) || (row.lap_time !== undefined && previous.first.lap_time !== undefined ?
              ((number(row.lap_source_time) ?? row.sessionTime) - (number(previous.first.lap_source_time) ?? previous.first.sessionTime)) * 1000 + previous.first.lap_time - row.lap_time : undefined);
            if (consecutive && startsNearLine && (previous.lap.rowCount || 0) > 1 && finishTime !== undefined && finishTime > 0) {
              previous.lap.isComplete = true;
              previous.lap.lapTime = finishTime;
            }
          }
          if (index.laps.length >= MAX_INDEX_LAPS) throw new Error("The recording has more than 100,000 lap segments.");
          const sequence = previous ? previous.sequence + 1 : 0;
          const lapId = `${encodeURIComponent(id)}:${encodeURIComponent(participantId)}:${row.lap_number ?? "segment"}:${sequence}`;
          const lap: ParquetLap = { lapId, participantId, participant, sessionId: id, uniqueSessionId: id,
            startTime: row.sessionTime, endTime: row.sessionTime, rowStart: physical, rowEnd: physical + 1,
            lapNumber: row.lap_number, rowCount: 0, isComplete: false, isValid: true, isInLap: false, isOutLap: false };
          index.laps.push(lap); participant.lapIds.push(lapId);
          active.set(participantId, { lap, first: row, last: row, sequence });
        }
        const state = active.get(participantId)!;
        state.last = row;
        state.lap.rowCount = (state.lap.rowCount || 0) + 1;
        state.lap.rowEnd = physical + 1;
        state.lap.endTime = row.sessionTime;
        state.lap.lapTime = row.lap_time;
        if (row.lap_invalid === true || row.lap_invalid === 1) state.lap.isValid = false;
      }
    }
    index.rowCount += Number(opened.metadata.num_rows);
  }
  if (!index.rowCount) throw new Error("The Parquet file contains no telemetry samples.");
  index.columns = [...columns]; index.participants = [...participants.values()];
  options.onProgress?.(`Indexed ${index.rowCount.toLocaleString()} samples and ${index.laps.length} lap segments.`);
  return { storage: "parquet", sources: input.sources, index };
}

export function parquetSession(index: ParquetIndex): LocalSession {
  const document = { format: "racehub-telemetry" as const, version: 1 as const, id: index.id, name: index.name,
    simulator: index.simulator, createdAt: index.createdAt, trackName: index.trackName, trackLength: index.trackLength, rows: [] };
  return { document, rows: [], laps: index.laps, participants: index.participants, session: {
    uniqueSessionId: index.id, sessionId: 0, userId: "", name: index.name, simulator: index.simulator,
    trackName: index.trackName, trackLength: index.trackLength || 0, fileCreated: new Date(index.createdAt),
    rowCount: index.rowCount, totalLaps: index.laps.length, lapIds: index.laps.map(lap => lap.lapId),
    participantIds: index.participants.map(participant => participant.participantId), participants: index.participants,
    localLaps: index.laps, sessionType: "Recorded session", weather: "",
  } as unknown as LocalSession["session"] };
}

export async function loadParquetLaps(recording: ParquetRecording, lapIds: string[], options: ReadOptions = {}): Promise<TelemetryRow[]> {
  const { index } = recording;
  const selected = index.laps.filter(lap => lapIds.includes(lap.lapId));
  if (selected.reduce((total, lap) => total + (lap.rowCount || 0), 0) > MAX_SELECTED_ROWS) throw new Error("Select fewer laps. The chart view permits at most 500,000 selected samples.");
  const result: TelemetryRow[] = [];
  let selectedBytes = 0;
  for (let part = 0; part < recording.sources.length; part++) {
    const offset = index.parts[part].rowStart;
    const end = offset + index.parts[part].rowCount;
    const laps = selected.filter(lap => lap.rowStart < end && lap.rowEnd > offset);
    if (!laps.length) continue;
    const opened = await metadataFor(recording.sources[part], options);
    if (Number(opened.metadata.num_rows) !== index.parts[part].rowCount || opened.header.id !== undefined && text(opened.header.id) !== index.id) throw new Error("The Parquet source changed. Import it again before selecting laps.");
    for (const group of groups(opened.metadata, opened.columns)) {
      if (!laps.some(lap => lap.rowStart < offset + group.rowEnd && lap.rowEnd > offset + group.rowStart)) continue;
      stopped(options);
      options.onProgress?.(`Loading selected laps: ${result.length.toLocaleString()} samples`);
      const rows = await parquetReadObjects({ file: opened.file, metadata: opened.metadata, compressors: boundedCompressors, columns: opened.columns, ...group });
      for (let position = 0; position < rows.length; position++) {
        const physical = offset + group.rowStart + position;
        const row = normalizeRow(rowValues(rows[position], opened.header, index.simulator), index.simulator, physical);
        const lap = laps.find(candidate => candidate.participantId === row.participantId && physical >= candidate.rowStart && physical < candidate.rowEnd);
        if (lap) {
          selectedBytes += Object.entries(row).reduce((bytes, [key, value]) => bytes + 32 + key.length * 2 + (typeof value === "string" ? value.length * 2 : 8), 64);
          if (selectedBytes > MAX_SELECTED_BYTES) throw new Error("The selected lap view exceeds 64 MiB. Select fewer laps. The original file is unchanged.");
          result.push({ ...row, lapId: lap.lapId, simulator: index.simulator, session_id: index.id });
        }
      }
    }
  }
  stopped(options);
  return result;
}
