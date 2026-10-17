import { indexParquetParts, loadParquetLaps } from "./parquet.ts";
import type { NativeParquetDescriptor, ParquetRecording, ParquetSource } from "./parquet";

export type ParquetTask = { kind: "index"; sources: ParquetSource[]; metadata?: Partial<NativeParquetDescriptor>; simulator?: NativeParquetDescriptor["simulator"] }
  | { kind: "load"; recording: ParquetRecording; lapIds: string[] };

self.onmessage = async (event: MessageEvent<ParquetTask>) => {
  try {
    const options = { onProgress: (progress: string) => self.postMessage({ progress }) };
    const task = event.data;
    const result = task.kind === "index" ? await indexParquetParts(task, options) : await loadParquetLaps(task.recording, task.lapIds, options);
    self.postMessage({ result });
  } catch (failure) {
    self.postMessage({ error: failure instanceof Error ? failure.message : "The Parquet operation failed." });
  }
};
