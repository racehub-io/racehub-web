import { normalizeSession } from "./data";
import type { Simulator, TelemetrySession } from "./data";
import type { ParquetRecording } from "./parquet";

export interface SessionSummary {
  id: string;
  name: string;
  simulator: Simulator;
  trackName: string;
  createdAt: string;
  rowCount: number;
  lapCount: number;
  storage?: "parquet";
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser storage is unavailable. Enable IndexedDB to keep local sessions."));
      return;
    }
    const request = indexedDB.open("racehub-telemetry", 2);
    request.onupgradeneeded = () => {
      for (const name of ["sessions", "catalogue", "parquet"]) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(new Error("Cannot open browser storage. Check your browser privacy and storage settings."));
    request.onblocked = () => reject(new Error("Close other RaceHub tabs, then retry the storage operation."));
    request.onsuccess = () => resolve(request.result);
  });
}

function storageError(error: DOMException | null): Error {
  return new Error(error?.name === "QuotaExceededError"
    ? "Browser storage is full. Export and delete a session, then retry. The input file is unchanged."
    : "The local session could not be saved. Check browser storage permissions and retry.");
}

export async function saveSession(document: TelemetrySession): Promise<void> {
  const normalized = normalizeSession(document);
  const safe = normalized.document;
  const summary: SessionSummary = {
    id: safe.id, name: safe.name, simulator: safe.simulator,
    trackName: safe.trackName, createdAt: safe.createdAt,
    rowCount: normalized.rows.length, lapCount: normalized.laps.length,
  };
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["sessions", "catalogue"], "readwrite");
      transaction.objectStore("sessions").put(normalized.document);
      transaction.objectStore("catalogue").put(summary);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally { db.close(); }
}

export async function loadSessions(): Promise<SessionSummary[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("catalogue").objectStore("catalogue").getAll();
      request.onsuccess = () => resolve((request.result as SessionSummary[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      request.onerror = () => reject(new Error("Cannot read the local session library."));
    });
  } finally { db.close(); }
}

export async function getSession(id: string): Promise<TelemetrySession | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("sessions").objectStore("sessions").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Cannot read this local session."));
    });
  } finally { db.close(); }
}

export async function saveParquet(recording: ParquetRecording): Promise<void> {
  const { index } = recording;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["parquet", "catalogue"], "readwrite");
      transaction.objectStore("parquet").put({ id: index.id, ...recording });
      transaction.objectStore("catalogue").put({ id: index.id, name: index.name, simulator: index.simulator,
        trackName: index.trackName, createdAt: index.createdAt, rowCount: index.rowCount, lapCount: index.laps.length, storage: "parquet" });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally { db.close(); }
}

export async function getParquet(id: string): Promise<ParquetRecording | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("parquet").objectStore("parquet").get(id);
      request.onsuccess = () => resolve(request.result as ParquetRecording | undefined);
      request.onerror = () => reject(new Error("Cannot read this Parquet recording."));
    });
  } finally { db.close(); }
}

export async function deleteSession(id: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["sessions", "catalogue", "parquet"], "readwrite");
      transaction.objectStore("sessions").delete(id);
      transaction.objectStore("catalogue").delete(id);
      transaction.objectStore("parquet").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error("The local session could not be deleted."));
      transaction.onerror = () => reject(new Error("The local session could not be deleted."));
    });
  } finally { db.close(); }
}
