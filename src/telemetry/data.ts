import type { Lap, Participant, Session } from "../types";

export type Simulator = "f1" | "iracing" | "rfactor2";
export const MAX_ROWS = 500_000;
export const MAX_FILE_BYTES = 128 * 1024 * 1024;

export interface TelemetryRow {
  [channel: string]: string | number | boolean | null | undefined;
  participantId: string;
  lapId?: string;
  sessionTime: number;
  lap_number?: number;
  lap_time?: number;
  lap_distance?: number;
  speed?: number;
  throttle?: number;
  brake?: number;
  steer?: number;
  gear?: number;
  engine_rpm?: number;
  world_x?: number;
  world_y?: number;
  world_z?: number;
}

export interface TelemetrySession {
  format: "racehub-telemetry";
  version: 1;
  id: string;
  simulator: Simulator;
  name: string;
  createdAt: string;
  trackName: string;
  trackLength?: number;
  scope?: "player" | "all";
  sampleHz?: number;
  rows: TelemetryRow[];
}

export interface LocalSession {
  document: TelemetrySession;
  session: Session & { simulator: Simulator; name: string; localLaps: Lap[] };
  participants: Participant[];
  laps: Lap[];
  rows: TelemetryRow[];
}

type RecordValue = Record<string, unknown>;
const games: Simulator[] = ["f1", "iracing", "rfactor2"];
const excludedKeys = new Set(["__proto__", "prototype", "constructor"]);
const numericChannels = new Set([
  "speed", "throttle", "brake", "steer", "clutch", "gear", "engine_rpm",
  "sessionTime", "lap_time", "last_lap_time", "lap_distance", "lap_number",
  "track_length", "world_x", "world_y", "world_z", "lap_invalid",
  "sector_1_time", "sector_2_time", "sector_3_time", "pit_status",
]);
const textChannel = /(?:^id$|id$|name|abbreviation|nationality|simulator|session_type|weather|created_at|recorded_at)/i;

function object(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "bigint") {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : undefined;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function text(value: unknown, fallback = ""): string {
  return (typeof value === "string" || typeof value === "number")
    ? String(value).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 240) || fallback
    : fallback;
}

function first(rows: RecordValue[], key: string): unknown {
  return rows.find(row => row[key] !== null && row[key] !== undefined)?.[key];
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function legacyColumns(input: RecordValue): RecordValue[] | undefined {
  const entries = Object.entries(input).filter(([key]) => !excludedKeys.has(key));
  if (!entries.length) return undefined;
  if (entries.every(([, value]) => Array.isArray(value))) {
    const length = (entries[0][1] as unknown[]).length;
    if (length > MAX_ROWS || !entries.every(([, value]) => (value as unknown[]).length === length)) {
      throw new Error("The telemetry columns have different lengths or too many rows.");
    }
    return Array.from({ length }, (_, index) => Object.fromEntries(
      entries.map(([key, value]) => [key, (value as unknown[])[index]])
    ));
  }
  // The Python collector stores channel -> car -> [session seconds, value].
  if (!entries.every(([, value]) => object(value))) return undefined;
  const rows = new Map<string, RecordValue>();
  for (const [channel, cars] of entries) {
    if (!object(cars)) return undefined;
    for (const [car, values] of Object.entries(cars)) {
      if (!Array.isArray(values)) return undefined;
      for (const point of values) {
        if (!Array.isArray(point) || point.length !== 2 || finite(point[0]) === undefined) return undefined;
        const time = finite(point[0])!;
        const key = `${car}\u0000${time}`;
        if (!rows.has(key)) rows.set(key, { participantId: car, sessionTime: time });
        rows.get(key)![channel] = point[1];
        if (rows.size > MAX_ROWS) throw new Error("The recording has more than 500,000 samples.");
      }
    }
  }
  return Array.from(rows.values()).sort((a, b) => Number(a.sessionTime) - Number(b.sessionTime));
}

export function normalizeRow(input: RecordValue, simulator: Simulator, index: number): TelemetryRow {
  const row: RecordValue = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    if (excludedKeys.has(key) || key.length > 100) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) row[key] = value;
    } else if (typeof value === "bigint") {
      row[key] = Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
    } else if (typeof value === "string" && value !== "") {
      if (["lap_invalid", "participant_isAI"].includes(key) && /^(true|false)$/.test(value)) row[key] = value === "true";
      else row[key] = numericChannels.has(key) || (!textChannel.test(key) && finite(value) !== undefined)
        ? finite(value) : value.slice(0, 1000);
    } else if (typeof value === "boolean") row[key] = value;
  }
  const aliases: Record<string, string> = simulator === "iracing" ? {
    SessionTime: "sessionTime", Lap: "lap_number", LapDist: "lap_distance",
    Throttle: "throttle", Brake: "brake", Gear: "gear", RPM: "engine_rpm",
    CarIdx: "carIndex", DriverName: "participant_name", TrackName: "track_name",
  } : simulator === "rfactor2" ? {
    mElapsedTime: "sessionTime", mLapDist: "lap_distance", mLapNumber: "lap_number",
    mUnfilteredThrottle: "throttle", mUnfilteredBrake: "brake", mUnfilteredSteering: "steer",
    mGear: "gear", mEngineRPM: "engine_rpm", mID: "carIndex", mDriverName: "participant_name",
  } : {};
  for (const [source, destination] of Object.entries(aliases)) {
    if (row[destination] === undefined && input[source] !== undefined) {
      row[destination] = destination.endsWith("name") ? text(input[source]) : finite(input[source]);
    }
  }
  if (row.lap_time === undefined && finite(input.current_lap_time) !== undefined) {
    row.lap_time = finite(input.current_lap_time)! * 1000;
  }
  if (row.last_lap_time === undefined && finite(input.previous_lap_time) !== undefined) {
    row.last_lap_time = finite(input.previous_lap_time)! * 1000;
  }
  if (row.lap_invalid === undefined && input.lap_valid !== undefined) row.lap_invalid = finite(input.lap_valid);
  if (simulator === "iracing") {
    if (row.speed === undefined && finite(input.Speed) !== undefined) row.speed = finite(input.Speed)! * 3.6;
    if (row.lap_time === undefined && finite(input.LapCurrentLapTime) !== undefined) {
      row.lap_time = finite(input.LapCurrentLapTime)! * 1000;
    }
  }
  if (simulator === "rfactor2" && row.lap_time === undefined && finite(input.mLapStartET) !== undefined) {
    const elapsed = finite(row.sessionTime);
    if (elapsed !== undefined) row.lap_time = (elapsed - finite(input.mLapStartET)!) * 1000;
  }
  const time = finite(row.sessionTime ?? input.session_time ?? input.sessionTime);
  if (time === undefined || time < 0) throw new Error(`Sample ${index + 1} needs a finite sessionTime in seconds.`);
  const participantId = text(input.participantId ?? input.participant_id ?? input.carIndex ?? input.CarIdx ?? input.mID, "driver");
  row.sessionTime = time;
  row.participantId = participantId;
  for (const channel of ["throttle", "brake", "steer"]) {
    const value = finite(row[channel]);
    if (value !== undefined && (value < (channel === "steer" ? -1 : 0) || value > 1)) {
      throw new Error(`Sample ${index + 1}: ${channel} must use a ${channel === "steer" ? "-1 to 1" : "0 to 1"} scale.`);
    }
  }
  if (finite(row.lap_time) !== undefined && Number(row.lap_time) < 0) delete row.lap_time;
  if (finite(row.speed) !== undefined && Number(row.speed) < 0) delete row.speed;
  return row as TelemetryRow;
}

export function normalizeSession(input: unknown, simulator?: Simulator): LocalSession {
  const metadata = object(input) ? input : {};
  if (metadata.format !== undefined && metadata.format !== "racehub-telemetry") {
    throw new Error("This file does not use the RaceHub telemetry format.");
  }
  if (metadata.format === "racehub-telemetry" && metadata.version !== 1) {
    throw new Error("This RaceHub file version is not supported. Expected version 1.");
  }
  let sourceRows: unknown = Array.isArray(input) ? input : metadata.rows ?? metadata.data;
  if (!Array.isArray(sourceRows) && object(metadata.telemetry)) sourceRows = legacyColumns(metadata.telemetry);
  if (!Array.isArray(sourceRows)) sourceRows = legacyColumns(metadata);
  if (!Array.isArray(sourceRows) || !sourceRows.length) throw new Error("The file contains no telemetry samples.");
  if (sourceRows.length > MAX_ROWS) throw new Error("The recording has more than 500,000 samples. Split it before import.");
  if (!sourceRows.every(object)) throw new Error("Every telemetry sample must be an object.");
  const raw = sourceRows as RecordValue[];
  const game = metadata.simulator ?? first(raw, "simulator") ?? simulator;
  if (!games.includes(game as Simulator)) throw new Error("Select F1, iRacing, or rFactor 2 for this file.");
  const sourceGame = game as Simulator;
  if (raw.some(row => row.simulator !== undefined && row.simulator !== sourceGame)) {
    throw new Error("The file contains more than one game. Import each game separately.");
  }
  const identities = new Set(raw.map(row => text(row.session_id ?? row.uniqueSessionID ?? row.uniqueSessionId ?? row.sessionId)).filter(Boolean));
  if (identities.size > 1) throw new Error("The file contains more than one session. Import each session separately.");
  const id = text(metadata.id ?? first(raw, "session_id") ?? first(raw, "uniqueSessionID") ?? first(raw, "uniqueSessionId") ?? first(raw, "sessionId"), newId());
  const name = text(metadata.name ?? first(raw, "session_name"), `${sourceGame} recording`);
  const date = text(metadata.createdAt ?? first(raw, "created_at") ?? first(raw, "recorded_at"));
  if (date && !Number.isFinite(Date.parse(date))) throw new Error("The recording date is invalid.");
  const createdAt = date ? new Date(date).toISOString() : new Date().toISOString();
  const trackName = text(metadata.trackName ?? first(raw, "track_name") ?? first(raw, "TrackName"));
  const trackLength = finite(metadata.trackLength ?? first(raw, "track_length"));
  if (trackLength !== undefined && trackLength <= 0) throw new Error("Track length must be positive and use metres.");
  const rows = raw.map((row, index) => normalizeRow(row, sourceGame, index));
  if (!rows.some(row => [row.speed, row.throttle, row.brake, row.steer, row.gear, row.engine_rpm].some(value => finite(value) !== undefined))) {
    throw new Error("The file has no supported driving channels.");
  }
  const participants = new Map<string, Participant>();
  const grouped = new Map<string, TelemetryRow[]>();
  const current = new Map<string, { number?: number; time: number; lapTime?: number; sequence: number; lapId: string }>();
  for (const row of rows) {
    const participantId = row.participantId;
    if (!participants.has(participantId)) {
      participants.set(participantId, {
        participantId, name: text(row.participant_name, participantId),
        firstName: text(row.participant_first_name), lastName: text(row.participant_last_name),
        abbreviation: text(row.participant_abbreviation), nationality: text(row.participant_nationality),
        teamName: text(row.participant_team_name), raceNumber: finite(row.participant_race_number) ?? 0,
        isAi: row.participant_isAI === 1 || row.participant_isAI === true,
        isPlayer: row.playerCarIndex !== undefined && row.playerCarIndex === row.carIndex,
        lapIds: [], sessionId: 0, storagePath: "", uniqueSessionId: id,
      });
    }
    const previous = current.get(participantId);
    const number = finite(row.lap_number);
    if (number !== undefined && !Number.isInteger(number)) throw new Error("Lap numbers must be whole numbers.");
    const lapTime = finite(row.lap_time);
    const boundary = previous && (number !== previous.number || row.sessionTime < previous.time ||
      (number === undefined && lapTime !== undefined && previous.lapTime !== undefined && lapTime + 1000 < previous.lapTime));
    const sequence = previous ? previous.sequence + (boundary ? 1 : 0) : 0;
    const lapId = `${encodeURIComponent(id)}:${encodeURIComponent(participantId)}:${number ?? "segment"}:${sequence}`;
    row.lapId = lapId;
    row.simulator = sourceGame;
    row.session_id = id;
    row.session_name = name;
    row.created_at = createdAt;
    if (trackName) row.track_name = trackName;
    if (trackLength !== undefined) row.track_length = trackLength;
    current.set(participantId, { number, time: row.sessionTime, lapTime, sequence, lapId });
    if (!grouped.has(lapId)) {
      grouped.set(lapId, []);
      participants.get(participantId)!.lapIds.push(lapId);
    }
    grouped.get(lapId)!.push(row);
  }
  const laps: Lap[] = [];
  for (const [lapId, samples] of grouped) {
    const start = samples[0];
    const end = samples[samples.length - 1];
    const participant = participants.get(start.participantId)!;
    const nextId = participant.lapIds[participant.lapIds.indexOf(lapId) + 1];
    const next = nextId ? grouped.get(nextId)?.[0] : undefined;
    const startsNearLine = (finite(start.lap_distance) !== undefined && Number(start.lap_distance) <= Math.max(50, (trackLength || 0) * 0.02) && Number(start.lap_distance) >= -50)
      || (finite(start.lap_time) !== undefined && Number(start.lap_time) <= 2000);
    const consecutive = next && next.sessionTime > end.sessionTime &&
      (start.lap_number === undefined || next.lap_number === Number(start.lap_number) + 1);
    const nextTime = consecutive ? finite(next.last_lap_time) : undefined;
    const measuredDuration = consecutive && finite(start.lap_time) !== undefined && finite(next.lap_time) !== undefined
      ? (next.sessionTime - start.sessionTime) * 1000 + Number(start.lap_time) - Number(next.lap_time) : undefined;
    const finishTime = nextTime && nextTime > 0 ? nextTime : measuredDuration;
    const isComplete = samples.length > 1 && startsNearLine && finishTime !== undefined && finishTime > 0;
    const lapTime = isComplete ? finishTime : finite(end.lap_time);
    laps.push({
      lapId, participantId: start.participantId, participant, sessionId: id, uniqueSessionId: id,
      startTime: start.sessionTime, endTime: end.sessionTime, isComplete,
      isValid: !samples.some(row => row.lap_invalid === 1 || row.lap_invalid === true),
      isInLap: Number(end.pit_status) > 0, isOutLap: Number(start.pit_status) > 0,
      lapNumber: finite(start.lap_number), lapTime, rowCount: samples.length,
      sector1Time: finite(end.sector_1_time), sector2Time: finite(end.sector_2_time),
      sector3Time: finite(end.sector_3_time),
    } as Lap);
  }
  const document: TelemetrySession = {
    format: "racehub-telemetry", version: 1, id, simulator: sourceGame,
    name, createdAt, trackName, ...(trackLength === undefined ? {} : { trackLength }), rows,
    ...(["player", "all"].includes(String(metadata.scope)) ? { scope: metadata.scope as "player" | "all" } : {}),
    ...(finite(metadata.sampleHz) !== undefined ? { sampleHz: finite(metadata.sampleHz) } : {}),
  };
  const session = {
    uniqueSessionId: id, sessionId: 0, userId: "", name, simulator: sourceGame,
    trackName, trackLength: trackLength ?? 0, fileCreated: new Date(createdAt),
    rowCount: rows.length, totalLaps: laps.length, lapIds: laps.map(lap => lap.lapId),
    participantIds: Array.from(participants.keys()), participants: Array.from(participants.values()), localLaps: laps,
    sessionType: text(first(raw, "session_type"), "Recorded session"),
    airTemperature: finite(first(raw, "air_temperature")),
    trackTemperature: finite(first(raw, "track_temperature")), weather: text(first(raw, "weather")),
  } as unknown as LocalSession["session"];
  return { document, session, participants: Array.from(participants.values()), laps, rows };
}

export function combineSessions(documents: TelemetrySession[]): LocalSession {
  if (documents.length < 2) throw new Error("Open a recording, then select another recording to compare.");
  const sessions = documents.map(document => normalizeSession(document));
  const first = sessions[0].document;
  const track = first.trackName.trim().toLowerCase();
  if (!track || /^(unknown|track not recorded)/.test(track)) {
    throw new Error("Track identity is missing. Compare laps within this recording instead.");
  }
  const ids = new Set<string>();
  const rows: TelemetryRow[] = [];
  for (const local of sessions) {
    const document = local.document;
    const sources = new Set(local.rows.map(row => text(row.source_session_id, document.id)));
    if (Array.from(sources).some(id => ids.has(id))) throw new Error("This recording is already in the comparison.");
    sources.forEach(id => ids.add(id));
    if (document.simulator !== first.simulator || document.trackName.trim().toLowerCase() !== track) {
      throw new Error("Only recordings from the same game and track can be compared.");
    }
    if (first.trackLength && document.trackLength && Math.abs(first.trackLength - document.trackLength) / first.trackLength > 0.01) {
      throw new Error("These recordings use different track lengths or layouts.");
    }
    for (const row of local.rows) {
      const sourceId = text(row.source_session_id, document.id);
      const participantId = text(row.source_participant_id, row.participantId);
      rows.push({ ...row, participantId: `${sourceId}/${participantId}`,
        participant_name: row.source_session_id ? row.participant_name : `${text(row.participant_name, row.participantId)} · ${document.name}`,
        source_session_id: sourceId, source_participant_id: participantId });
    }
  }
  const document: TelemetrySession = {
    ...first, id: newId(), name: sessions.map(local => local.document.name).join(" vs ").slice(0, 240),
    createdAt: new Date().toISOString(), rows,
  };
  rows.forEach(row => { row.session_id = document.id; });
  return normalizeSession(document);
}

export function parseCsv(csv: string): RecordValue[] {
  const records: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else if (char === ",") { row.push(field); field = ""; closed = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      if (row.some(value => value !== "")) records.push(row);
      row = []; field = ""; closed = false;
    } else {
      if (closed || char === '"') throw new Error("The CSV contains text outside a quoted field.");
      field += char;
    }
    if (records.length > MAX_ROWS + 1) throw new Error("The CSV has too many samples.");
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some(value => value !== "")) records.push(row);
  const headers = records.shift()?.map(value => value.trim());
  if (!headers?.length || new Set(headers).size !== headers.length || headers.some(key => !key || excludedKeys.has(key))) {
    throw new Error("The CSV needs unique, non-empty column names.");
  }
  return records.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((key, column) => [key, cells[column]]));
  });
}

async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, content = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_FILE_BYTES) throw new Error("The expanded file exceeds 128 MiB.");
      content += decoder.decode(value, { stream: true });
    }
    return content + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}

export async function parseTelemetryFile(file: File, simulator?: Simulator): Promise<LocalSession> {
  if (file.size > MAX_FILE_BYTES) throw new Error("The file exceeds 128 MiB. Split the recording before import.");
  if (!file.size) throw new Error("The file is empty.");
  const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...magic) === "PAR1") throw new Error("Open Parquet through the session library to read selected laps.");
  let input: unknown;
  let stream = file.stream();
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open gzip files. Decompress the file first.");
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  }
  const content = (await readText(stream)).trim();
  if (!content || content.includes("\u0000")) throw new Error("The file is empty or uses an unsupported binary format.");
  if (/\.csv(?:\.gz)?$/i.test(file.name)) input = parseCsv(content);
  else {
    try { input = JSON.parse(content); }
    catch {
      try {
        const lines = content.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
        input = object(lines[0]) && lines[0].format === "racehub-telemetry"
          ? { ...lines[0], rows: lines.slice(1) } : lines;
      } catch { throw new Error("Use RaceHub JSON, NDJSON, CSV, gzip JSON, or a Parquet recording."); }
    }
  }
  const result = normalizeSession(input, simulator);
  if (!object(input) || !input.name) {
    result.document.name = file.name.replace(/\.(jsonl?|ndjson|csv|parquet|gz|rhc)$/gi, "");
    result.rows.forEach(row => { row.session_name = result.document.name; });
  }
  result.session.name = result.document.name;
  return result;
}

export function exportJson(document: TelemetrySession): string {
  return JSON.stringify(document, function(this: RecordValue, key, value) {
    if (typeof this.participantId !== "string" || typeof this.sessionTime !== "number") return value;
    if (key === "lapId" || key === "session_id" && !this.source_session_id && value === document.id ||
      key === "session_name" && value === document.name || key === "created_at" && value === document.createdAt ||
      key === "simulator" && value === document.simulator || key === "track_name" && value === document.trackName ||
      key === "track_length" && value === document.trackLength) return undefined;
    return value;
  });
}

export function exportCsv(rows: TelemetryRow[]): string {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row)))).filter(key => !excludedKeys.has(key));
  const cell = (value: unknown) => {
    let string = value === undefined || value === null ? "" : String(value);
    // Keep text cells inert when a spreadsheet opens the export.
    if (typeof value === "string" && /^[=+@\t\r-]/.test(string)) string = "'" + string;
    return /[",\r\n]/.test(string) ? '"' + string.replace(/"/g, '""') + '"' : string;
  };
  return [columns.map(cell).join(","), ...rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n");
}
