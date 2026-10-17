import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch as useReduxDispatch } from "react-redux";
import { loadRaceFile, LOAD_PARTICIPANTS_FILE, SELECT_SESSION, RECORDER_STATUS, WS_NEW_STATUS } from "../../../modules/race/actions";
import { useDispatch } from "../../../modules/context";
import { normalizeSession, Simulator, TelemetryRow, TelemetrySession } from "../../../telemetry/data";
import { saveSession } from "../../../telemetry/library";
import { importNativeParquet } from "../../../telemetry/parquetClient";
import type { NativeParquetDescriptor } from "../../../telemetry/parquet";
import styles from "./Recorder.module.scss";

interface RecorderStatus {
  recording: boolean;
  engine?: "native" | "javascript" | null;
  nativeAvailable?: boolean;
  captureRate?: "source" | "sampled";
  counters?: {received?: number; rejected?: number; dropped?: number; rows?: number} | null;
  simulator: Simulator | null;
  name: string | null;
  sampleCount: number;
  lastSampleAt: string | null;
  error: string | null;
  scope: "player" | "all" | null;
  sampleHz: number | null;
  ports: { f1: number; iracing: number; rfactor2: number };
}

async function request(path: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), path === "status" ? 5000 : 60000);
  try {
    const response = await fetch(`/api/${path}`, {
      signal: controller.signal,
      ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const result = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(result?.error || "The local recorder request failed.");
    if (!result) throw new Error("The local recorder returned an invalid response.");
    return result;
  } catch (failure) {
    if (failure instanceof Error && failure.name === "AbortError") throw new Error("The local recorder did not respond in time. Check its status before you try again.");
    throw failure;
  } finally { window.clearTimeout(timeout); }
}

export function Recorder(_props: { title?: string }) {
  const { dispatch } = useDispatch();
  const reduxDispatch = useReduxDispatch();
  const [status, setStatus] = useState<RecorderStatus>();
  const [available, setAvailable] = useState(false);
  const [simulator, setSimulator] = useState<Simulator>("f1");
  const [engine, setEngine] = useState<"native" | "javascript">("native");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"player" | "all">("player");
  const [sampleHz, setSampleHz] = useState(10);
  const [pending, setPending] = useState<"" | "start" | "stop">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [latest, setLatest] = useState<Record<string, unknown>>();
  const [viewingLive, setViewingLive] = useState(false);
  const liveRows = useRef<TelemetryRow[]>([]);
  const liveDocument = useRef<TelemetrySession>();
  const liveEnabled = useRef(false);
  const lastPreview = useRef(0);
  const currentStatus = useRef<RecorderStatus>();
  const completed = useRef(new Map<string, Promise<void>>());

  const updateStatus = useCallback((value: RecorderStatus) => {
    if (typeof value?.recording !== "boolean" || !Number.isFinite(value.sampleCount)) throw new Error("The recorder returned an invalid status.");
    setStatus(value);
    if (!currentStatus.current) setEngine(value.nativeAvailable ? "native" : "javascript");
    if (value.recording && value.engine) setEngine(value.engine);
    if (value.recording && (!currentStatus.current?.recording || value.simulator !== currentStatus.current.simulator)) {
      liveRows.current = [];
      liveDocument.current = undefined;
      setLatest(undefined);
    }
    currentStatus.current = value;
    if (value.recording && value.simulator) {
      setSimulator(value.simulator);
      setName(value.name || "");
      if (value.scope) setScope(value.scope);
      if (value.sampleHz) setSampleHz(value.sampleHz);
    }
    setAvailable(true);
    dispatch({ type: WS_NEW_STATUS, wsStatus: 1 });
    dispatch({ type: RECORDER_STATUS, payload: value });
  }, [dispatch]);

  const preview = useCallback(() => {
    const rows = liveRows.current;
    const source = currentStatus.current;
    if (!rows.length || !source?.simulator) return;
    if (!liveDocument.current) liveDocument.current = {
      format: "racehub-telemetry", version: 1, id: `live-${Date.now()}`,
      simulator: source.simulator, name: `${source.name || "Recording"} (live preview)`,
      createdAt: new Date().toISOString(), trackName: String(rows[rows.length - 1].track_name || ""), rows: [],
    };
    const local = normalizeSession({ ...liveDocument.current, rows });
    reduxDispatch(loadRaceFile(local.rows));
    dispatch({ type: LOAD_PARTICIPANTS_FILE, participants: local.participants });
    dispatch({ type: SELECT_SESSION, session: local.session, live: true });
    lastPreview.current = Date.now();
  }, [dispatch, reduxDispatch]);

  const saveCompleted = useCallback((id: string): Promise<void> => {
    const existing = completed.current.get(id);
    if (existing) return existing;
    const operation = (async () => {
      try {
        const document: unknown = await request(`sessions/${encodeURIComponent(id)}`);
        if (document && typeof document === "object" && "storage" in document && document.storage === "parquet") {
          const recording = await importNativeParquet(document as NativeParquetDescriptor, {
            onProgress: progress => setNotice(progress),
          });
          window.dispatchEvent(new CustomEvent("racehub:session-saved", { detail: { id: recording.index.id } }));
          setNotice("Added the Parquet recording to your library. Its data stays on the recorder's disk.");
          return;
        }
        const local = normalizeSession(document);
        await saveSession(local.document);
        window.dispatchEvent(new CustomEvent("racehub:session-saved", { detail: { id: local.document.id } }));
        setNotice(`Saved ${local.document.name} in this browser.`);
      } catch (failure) {
        completed.current.delete(id);
        throw failure;
      }
    })();
    completed.current.set(id, operation);
    return operation;
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await request("status");
        if (active) updateStatus(result);
      } catch {
        if (active) { setAvailable(false); dispatch({ type: WS_NEW_STATUS, wsStatus: 3 }); }
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    const events = new EventSource("/api/events");
    events.addEventListener("status", event => {
      try { updateStatus(JSON.parse((event as MessageEvent).data)); }
      catch { setError("The recorder sent an invalid status. Reconnect it before recording."); }
    });
    events.addEventListener("sample", event => {
      try {
        const rows = JSON.parse((event as MessageEvent).data);
        if (!Array.isArray(rows) || !rows.length || typeof rows[rows.length - 1] !== "object") return;
        setLatest(rows[rows.length - 1]);
        liveRows.current = [...liveRows.current, ...rows].slice(-3000);
        if (liveEnabled.current && Date.now() - lastPreview.current >= 500) preview();
      } catch { setError("The recorder sent an invalid sample batch."); }
    });
    events.addEventListener("session", event => {
      try {
        const summary = JSON.parse((event as MessageEvent).data);
        if (typeof summary?.id !== "string") throw new Error("The completed session has no ID.");
        saveCompleted(summary.id).catch(failure => setError(failure instanceof Error ? failure.message : "Could not save the completed recording in this browser. Use Load recorder sessions to retry."));
      } catch { setError("The recorder sent invalid session metadata. Use Load recorder sessions to retry."); }
    });
    events.onerror = () => { setAvailable(false); dispatch({ type: WS_NEW_STATUS, wsStatus: 3 }); };
    const leaveLive = () => { liveEnabled.current = false; setViewingLive(false); };
    window.addEventListener("racehub:session-opened", leaveLive);
    return () => { active = false; window.clearInterval(timer); events.close(); window.removeEventListener("racehub:session-opened", leaveLive); };
  }, [dispatch, preview, saveCompleted, updateStatus]);

  const start = async () => {
    setPending("start"); setError(""); setNotice(""); setLatest(undefined);
    try { updateStatus(await request("recording/start", { simulator, name: name.trim() || undefined, scope, sampleHz, engine })); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start recording."); }
    finally { setPending(""); }
  };
  const stop = async () => {
    setPending("stop"); setError("");
    try {
      const result = await request("recording/stop", {});
      updateStatus(result.status);
      if (result.session?.id) await saveCompleted(result.session.id);
      else setNotice("Recording stopped. No samples were saved.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not stop recording. Check the recorder status."); }
    finally { setPending(""); }
  };
  const recording = status?.recording === true;
  const port = status?.ports?.[recording && status.simulator ? status.simulator : simulator];
  return (
    <section className={styles.recorderWrapper} aria-label="Local recorder">
      <h2>Local recorder</h2>
      <p role="status">{available ? recording ? `Recording ${status?.name || status?.simulator}.` : "Recorder ready." : "Recorder unavailable. File import still works."}</p>
      {!available && <p>Start the local recorder with <code>npm run collector</code> in this project. Keep its terminal open.</p>}
      <label>Recording mode <select value={engine} disabled={recording || !!pending}
        onChange={e => setEngine(e.target.value as "native" | "javascript")}>
        <option value="native" disabled={!status?.nativeAvailable}>Parquet - full game rate</option>
        <option value="javascript">Sampled JSON</option>
      </select></label>
      {engine === "native" && <p>The native recorder uses the rate sent by the game. Native F1 recording supports F1 24. Use sampled JSON for other supported F1 versions.</p>}
      {!status?.nativeAvailable && available && <p>Follow the <a href="https://github.com/racehub-io/racehub-web#readme">setup guide</a> to enable the native recorder. Then restart RaceHub.</p>}
      <label>Game <select value={simulator} disabled={recording || !!pending}
        onChange={e => setSimulator(e.target.value as Simulator)}>
        <option value="f1">F1</option><option value="iracing">iRacing</option><option value="rfactor2">rFactor 2</option>
      </select></label>
      <label>Session name <input value={name} maxLength={120} disabled={recording || !!pending}
        onChange={e => setName(e.target.value)} /></label>
      <label>Drivers <select value={scope} disabled={recording || !!pending}
        onChange={e => setScope(e.target.value as "player" | "all")}>
        <option value="player">Player only</option><option value="all">All drivers</option>
      </select></label>
      {engine === "javascript" && <label>Samples per second, per driver <input type="number" min={1} max={60} step={1}
        value={sampleHz || ""} disabled={recording || !!pending}
        onChange={e => setSampleHz(Number(e.target.value))} /></label>}
      {engine === "javascript" && (!Number.isInteger(sampleHz) || sampleHz < 1 || sampleHz > 60) && <p role="alert">Choose a whole sample rate from 1 to 60.</p>}
      {engine === "javascript" && <p>JSON uses the sample rate you set. It stops at 500,000 samples or 128 MiB. Use native Parquet for longer sessions.</p>}
      {port && <p>Send {recording ? status?.simulator : simulator} UDP telemetry to this computer on port {port}.</p>}
      {simulator === "iracing" && <p>iRacing needs the local Windows telemetry bridge.</p>}
      {simulator === "rfactor2" && <p>rFactor 2 needs the UDP broadcaster plug-in.</p>}
      <div className={styles.buttons}>
        <button type="button" disabled={!available || recording || !!pending || engine === "native" && !status?.nativeAvailable || engine === "javascript" && (!Number.isInteger(sampleHz) || sampleHz < 1 || sampleHz > 60)} onClick={start}>{pending === "start" ? "Starting..." : "Start recording"}</button>
        <button type="button" disabled={!available || !recording || !!pending} onClick={stop}>{pending === "stop" ? "Saving..." : "Stop and analyse"}</button>
        <button type="button" disabled={!recording || !latest} aria-pressed={viewingLive} onClick={() => {
          liveEnabled.current = !liveEnabled.current;
          setViewingLive(liveEnabled.current);
          if (liveEnabled.current) {
            try { preview(); } catch (failure) { liveEnabled.current = false; setViewingLive(false); setError(failure instanceof Error ? failure.message : "Could not display live samples."); }
          }
        }}>{viewingLive ? "Pause live view" : "View live samples"}</button>
      </div>
      {viewingLive && <p>Live preview shows the latest 3,000 samples. The recorder keeps the full recording.</p>}
      {status && <dl className={styles.metrics}>
        <div><dt>Recorded samples</dt><dd>{status.sampleCount.toLocaleString()}</dd></div>
        <div><dt>Last sample</dt><dd>{status.lastSampleAt ? new Date(status.lastSampleAt).toLocaleTimeString() : "None received"}</dd></div>
        {recording && latest && ["speed", "throttle", "brake", "gear"].map(channel => typeof latest[channel] === "number"
          ? <div key={channel}><dt>{channel === "speed" ? "Speed (km/h)" : channel}</dt><dd>{Number(latest[channel]).toFixed(channel === "gear" ? 0 : 2)}</dd></div> : null)}
      </dl>}
      {status?.counters && <p>Received packets: {status.counters.received?.toLocaleString() ?? "0"}. Rejected: {status.counters.rejected?.toLocaleString() ?? "0"}. Queue drops: {status.counters.dropped?.toLocaleString() ?? "0"}.</p>}
      {recording && latest && <p>Channel values show the last streamed sample.</p>}
      {recording && status?.sampleCount === 0 && <p>No samples yet. Enable game telemetry and check the bridge, address, and port.</p>}
      {(error || status?.error) && <p role="alert" className={styles.error}>{error || status?.error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
