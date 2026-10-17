import { useEffect, useState } from "react";
import { useStore } from "../modules/context";
import type { TelemetryRow } from "./data";
import type { ParquetRecording } from "./parquet";
import { readParquetLaps } from "./parquetClient";

export function useParquetSelection(recording: ParquetRecording | undefined, onLoadRows: (rows: TelemetryRow[]) => void) {
  const { store } = useStore();
  const selected = Object.keys(store.selectedLaps).sort().join("\n");
  const sessionId = store.selectedSession?.uniqueSessionId;
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!recording || recording.index.id !== sessionId) return;
    const controller = new AbortController();
    onLoadRows([]);
    setError("");
    if (!selected) { setProgress("Select a lap to read its Parquet samples."); return; }
    setProgress("Loading selected Parquet laps...");
    readParquetLaps(recording, selected.split("\n"), { signal: controller.signal, onProgress: setProgress })
      .then(rows => { if (!controller.signal.aborted) { onLoadRows(rows); setProgress(`Loaded ${rows.length.toLocaleString()} selected samples.`); } })
      .catch(failure => { if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : "Could not load the selected laps."); setProgress(""); } });
    return () => controller.abort();
  }, [recording, sessionId, selected, onLoadRows]);
  return { progress: recording?.index.id === sessionId ? progress : "", error: recording?.index.id === sessionId ? error : "" };
}
