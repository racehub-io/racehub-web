import type { NativeParquetDescriptor, ParquetRecording, ParquetSource, ReadOptions } from "./parquet";
import type { Simulator, TelemetryRow } from "./data";
import type { ParquetTask } from "./parquet.worker";
import { saveParquet } from "./library";

function runTask<T>(task: ParquetTask, options: ReadOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    options.signal?.throwIfAborted();
    const worker = new Worker(new URL("./parquet.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { worker.terminate(); options.signal?.removeEventListener("abort", abort); };
    const abort = () => { finish(); reject(new DOMException("The Parquet operation was cancelled.", "AbortError")); };
    options.signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { finish(); reject(new Error("The Parquet worker failed. The source file is unchanged.")); };
    worker.onmessage = (event: MessageEvent<{ progress?: string; result?: T; error?: string }>) => {
      if (event.data.progress) options.onProgress?.(event.data.progress);
      else if (event.data.error) { finish(); reject(new Error(event.data.error)); }
      else if (event.data.result !== undefined) { finish(); resolve(event.data.result); }
    };
    worker.postMessage(task);
  });
}

export async function importParquet(source: ParquetSource, simulator?: Simulator, options: ReadOptions = {}) {
  return importParquetParts([source], simulator, options);
}

export async function importParquetParts(sources: ParquetSource[], simulator?: Simulator, options: ReadOptions = {}) {
  const recording = await runTask<ParquetRecording>({ kind: "index", sources, simulator }, options);
  options.signal?.throwIfAborted();
  await saveParquet(recording);
  return recording;
}

export async function importNativeParquet(descriptor: NativeParquetDescriptor, options: ReadOptions = {}) {
  const recording = await runTask<ParquetRecording>({ kind: "index", sources: descriptor.parts, metadata: descriptor }, options);
  options.signal?.throwIfAborted();
  await saveParquet(recording);
  return recording;
}

export function readParquetLaps(recording: ParquetRecording, lapIds: string[], options: ReadOptions = {}) {
  return runTask<TelemetryRow[]>({ kind: "load", recording, lapIds }, options);
}
