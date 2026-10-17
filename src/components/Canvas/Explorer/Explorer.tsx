import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOAD_PARTICIPANTS_FILE, SELECT_SESSION } from "../../../modules/race/actions";
import { useDispatch, useStore } from "../../../modules/context";
import { combineSessions, exportCsv, exportJson, LocalSession, normalizeSession, parseTelemetryFile, Simulator } from "../../../telemetry/data";
import { deleteSession, getParquet, getSession, loadSessions, saveParquet, saveSession, SessionSummary } from "../../../telemetry/library";
import { parquetSession } from "../../../telemetry/parquet";
import type { NativeParquetDescriptor, ParquetRecording, ReadOptions } from "../../../telemetry/parquet";
import { importNativeParquet, importParquetParts, readParquetLaps } from "../../../telemetry/parquetClient";
import { useParquetSelection } from "../../../telemetry/useParquetSelection";
import { browserOnly, setupGuideUrl } from "../../../runtime";
import styles from "./Explorer.module.scss";

interface Props {
  title?: string;
  onLoadRows: (rows: LocalSession["rows"]) => void;
  onClear: () => void;
}

function download(name: string, content: string | Blob, type: string) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name.replace(/[\\/:*?"<>|]/g, "-");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Explorer({ onLoadRows, onClear }: Props) {
  const { dispatch } = useDispatch();
  const { store } = useStore();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [simulator, setSimulator] = useState<Simulator | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rename, setRename] = useState<{ id: string; name: string }>();
  const [removeId, setRemoveId] = useState<string>();
  const [current, setCurrent] = useState<LocalSession>();
  const [currentParquet, setCurrentParquet] = useState<ParquetRecording>();
  const [progress, setProgress] = useState("");
  const operation = useRef<AbortController>();
  const lazy = useParquetSelection(currentParquet, onLoadRows);
  const [unsavedComparison, setUnsavedComparison] = useState(false);
  const comparisonSources = useMemo(() => new Set(current?.rows.map(row => row.source_session_id)), [current]);

  const refresh = useCallback(async () => setSessions(await loadSessions()), []);
  const open = useCallback((local: LocalSession, comparison = false, parquet?: ParquetRecording) => {
    let selection: unknown;
    try { selection = JSON.parse(localStorage.getItem(`racehub:selection:${local.document.id}`) || "null"); }
    catch { selection = undefined; }
    onLoadRows(local.rows);
    dispatch({ type: LOAD_PARTICIPANTS_FILE, participants: local.participants });
    dispatch({ type: SELECT_SESSION, selection, session: { ...local.session, name: local.document.name,
      simulator: local.document.simulator, localLaps: local.laps } });
    window.dispatchEvent(new CustomEvent("racehub:session-opened", { detail: { id: local.document.id } }));
    setCurrent(local);
    setCurrentParquet(parquet);
    setUnsavedComparison(comparison);
    setNotice(`Opened ${local.document.name}.`);
  }, [dispatch, onLoadRows]);

  const run = async (action: (options: ReadOptions) => Promise<void>) => {
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    setProgress("");
    try { await action({ signal: controller.signal, onProgress: setProgress }); }
    catch (failure) {
      if (controller.signal.aborted) setNotice("Operation cancelled. The source file is unchanged.");
      else setError(failure instanceof Error ? failure.message : "The session operation failed.");
    }
    finally { operation.current = undefined; setBusy(false); setProgress(""); }
  };

  useEffect(() => { refresh().catch(failure => setError(String(failure.message || failure))); }, [refresh]);
  useEffect(() => {
    const saved = async (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      setError("");
      try {
        const document = await getSession(id);
        await refresh();
        if (document) open(normalizeSession(document));
        else {
          const parquet = await getParquet(id);
          if (parquet) open(parquetSession(parquet.index), false, parquet);
        }
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not open the completed recording."); }
    };
    window.addEventListener("racehub:session-saved", saved);
    return () => window.removeEventListener("racehub:session-saved", saved);
  }, [open, refresh]);

  const syncRecorder = async (options: ReadOptions) => {
    if (browserOnly) return;
    const response = await fetch("/api/sessions");
    if (!response.ok) throw new Error("The local recorder is unavailable. Start it, then try again.");
    const result = await response.json();
    if (!Array.isArray(result.sessions)) throw new Error("The recorder returned an invalid session list.");
    let added = 0;
    for (const summary of result.sessions) {
      if (typeof summary.id !== "string") throw new Error("A recorder session has no ID.");
      options.signal?.throwIfAborted();
      if (await getSession(summary.id) || await getParquet(summary.id)) continue;
      const detail = await fetch(`/api/sessions/${encodeURIComponent(summary.id)}`);
      if (!detail.ok) throw new Error(`Could not load recorder session ${summary.name || summary.id}.`);
      const value = await detail.json();
      if (summary.storage === "parquet") await importNativeParquet(value as NativeParquetDescriptor, options);
      else await saveSession(normalizeSession(value).document);
      added++;
    }
    await refresh();
    setNotice(`Added ${added} recorder session${added === 1 ? "" : "s"} to this browser.`);
  };

  const visible = sessions.filter(session => `${session.name} ${session.trackName} ${session.simulator}`
    .toLowerCase().includes(query.toLowerCase()));
  const opened = current?.document.id === store.selectedSession?.uniqueSessionId ? current : undefined;
  return (
    <section className={styles.explorerWrapper} aria-label="Session library">
      <h2>Session library</h2>
      <p>{browserOnly ? "Imported files stay in this browser. Export a copy before you clear browser data."
        : "Imported sessions stay in this browser. Native Parquet files stay on the recorder's disk. Export a copy before you clear browser data."}</p>
      {browserOnly && <p>This hosted app analyses files. For offline access and telemetry recording, follow the{" "}
        <a href={setupGuideUrl}>local setup guide</a>. Matching local source uses{" "}
        <code>telemetry/local-platform</code> until the pull requests merge. The guide covers all three repositories.</p>}
      <p>For one Parquet recording, select all its parts together. Import JSON or CSV files one at a time.</p>
      <div className={styles.importControls}>
        <label>Game for files without a game field
          <select value={simulator} disabled={busy} onChange={e => setSimulator(e.target.value as Simulator | "")}>
            <option value="">Detect from file</option><option value="f1">F1</option>
            <option value="iracing">iRacing</option><option value="rfactor2">rFactor 2</option>
          </select>
        </label>
        <label>Import telemetry
          <input type="file" multiple accept=".json,.ndjson,.jsonl,.csv,.pq,.parquet,.gz,.rhc" disabled={busy}
            onChange={e => {
              const files = Array.from(e.target.files || []).sort((a, b) => a.name.localeCompare(b.name));
              e.target.value = "";
              if (files.length) run(async options => {
                const parquetFiles = await Promise.all(files.map(async file => /\.(?:pq|parquet)$/i.test(file.name)
                  || String.fromCharCode(...new Uint8Array(await file.slice(0, 4).arrayBuffer())) === "PAR1"));
                if (files.length > 1 && !parquetFiles.every(Boolean)) {
                  throw new Error("Select only Parquet parts from one recording. Import JSON or CSV files one at a time.");
                }
                if (parquetFiles.every(Boolean)) {
                  const parquet = await importParquetParts(files.map(file => ({ blob: file, name: file.name })), simulator || undefined, options);
                  await refresh();
                  open(parquetSession(parquet.index), false, parquet);
                  return;
                }
                const file = files[0];
                const local = await parseTelemetryFile(file, simulator || undefined);
                options.signal?.throwIfAborted();
                await saveSession(local.document);
                await refresh();
                open(local);
              });
            }} />
        </label>
        {!browserOnly && <button type="button" disabled={busy} onClick={() => run(syncRecorder)}>Load recorder sessions</button>}
        {busy && <button type="button" onClick={() => operation.current?.abort()}>Cancel operation</button>}
      </div>
      <label className={styles.search}>Search sessions
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      {(error || lazy.error) && <p role="alert" className={styles.error}>{error || lazy.error}</p>}
      <p role="status">{busy ? progress || "Working..." : lazy.progress || notice}</p>
      {opened && currentParquet && <div className={styles.actions}>
        <span>Parquet: select laps to read their recorded samples.</span>
        <button type="button" disabled={busy || !Object.keys(store.selectedLaps).length} onClick={() => run(async options => {
          const rows = await readParquetLaps(currentParquet, Object.keys(store.selectedLaps), options);
          download(`${opened.document.name}-selected-laps.json`, exportJson({ ...opened.document, rows }), "application/json");
        })}>Export selected laps JSON</button>
        <button type="button" disabled={busy || !Object.keys(store.selectedLaps).length} onClick={() => run(async options => {
          const rows = await readParquetLaps(currentParquet, Object.keys(store.selectedLaps), options);
          download(`${opened.document.name}-selected-laps.csv`, exportCsv(rows), "text/csv");
        })}>Export selected laps CSV</button>
      </div>}
      {opened && unsavedComparison && <div className={styles.comparison}>
        <strong>Unsaved comparison: {opened.document.name}</strong>
        <p>The original sessions are unchanged. Save or export this comparison before you open another session.</p>
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={() => run(async () => {
            await saveSession(opened.document);
            await refresh();
            setUnsavedComparison(false);
            setNotice("Saved the comparison as a separate session.");
          })}>Save comparison</button>
          <button type="button" disabled={busy} onClick={() => download(`${opened.document.name}.json`, exportJson(opened.document), "application/json")}>Export comparison JSON</button>
          <button type="button" disabled={busy} onClick={() => download(`${opened.document.name}.csv`, exportCsv(opened.rows), "text/csv")}>Export comparison CSV</button>
        </div>
      </div>}
      {sessions.length === 0 && <p>{browserOnly ? "No imported sessions yet. Import a recording file." : "No local recordings yet. Import a file or use the recorder."}</p>}
      {sessions.length > 0 && visible.length === 0 && <p>No sessions match your search.</p>}
      <ul className={styles.sessionList}>
        {visible.map(session => <li key={session.id} className={styles.session}>
          <strong>{session.name}</strong>
          <span>{session.simulator === "f1" ? "F1" : session.simulator === "iracing" ? "iRacing" : "rFactor 2"}
            {" · "}{session.trackName || "Track not recorded"}{" · "}{session.lapCount} laps{" · "}{session.rowCount.toLocaleString()} samples</span>
          <time dateTime={session.createdAt}>{new Date(session.createdAt).toLocaleString()}</time>
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => run(async () => {
              if (session.storage === "parquet") {
                const parquet = await getParquet(session.id);
                if (!parquet) throw new Error("This Parquet session is no longer in the library.");
                open(parquetSession(parquet.index), false, parquet);
                return;
              }
              const document = await getSession(session.id);
              if (!document) throw new Error("This session is no longer in the browser library.");
              open(normalizeSession(document));
            })}>Open</button>
            {opened && !currentParquet && session.storage !== "parquet" && opened.document.id !== session.id && <button type="button"
              disabled={busy || opened.document.simulator !== session.simulator
                || !opened.document.trackName.trim() || /^(unknown|track not recorded)/i.test(opened.document.trackName.trim())
                || opened.document.trackName.trim().toLowerCase() !== session.trackName.trim().toLowerCase()
                || comparisonSources.has(session.id)}
              title="Compare recordings from the same game and track. Each recording can appear once."
              onClick={() => run(async () => {
                const document = await getSession(session.id);
                if (!document) throw new Error("This session is no longer in the browser library.");
                open(combineSessions([opened.document, document]), true);
              })}>Compare with open session</button>}
            <button type="button" disabled={busy} onClick={() => { setRename({ id: session.id, name: session.name }); setRemoveId(undefined); }}>Rename</button>
            {session.storage === "parquet" ? <button type="button" disabled={busy} onClick={() => run(async () => {
              const parquet = await getParquet(session.id);
              if (!parquet) throw new Error("This Parquet session is no longer in the library.");
              if (browserOnly && parquet.sources.some(source => "url" in source)) {
                throw new Error("This recording refers to a local recorder. Import the original Parquet file to use it here.");
              }
              for (const source of parquet.sources) {
                if ("blob" in source) download(source.name, source.blob, "application/vnd.apache.parquet");
                else {
                  const link = document.createElement("a"); link.href = source.url; link.download = source.name;
                  document.body.appendChild(link); link.click(); link.remove();
                }
              }
            })}>Export original Parquet</button> : <><button type="button" disabled={busy} onClick={() => run(async () => {
              const document = await getSession(session.id);
              if (!document) throw new Error("This session is no longer in the browser library.");
              download(`${session.name}.json`, exportJson(document), "application/json");
            })}>Export JSON</button>
            <button type="button" disabled={busy} onClick={() => run(async () => {
              const document = await getSession(session.id);
              if (!document) throw new Error("This session is no longer in the browser library.");
              download(`${session.name}.csv`, exportCsv(document.rows), "text/csv");
            })}>Export CSV</button></>}
            <button type="button" disabled={busy} onClick={() => { setRemoveId(session.id); setRename(undefined); }}>Remove</button>
          </div>
          {rename?.id === session.id && <form className={styles.actions} onSubmit={e => {
            e.preventDefault();
            run(async () => {
              const name = rename.name.trim();
              if (!name) throw new Error("Enter a session name.");
              if (session.storage === "parquet") {
                const parquet = await getParquet(session.id);
                if (!parquet) throw new Error("This Parquet session is no longer in the library.");
                parquet.index.name = name;
                await saveParquet(parquet); await refresh(); setRename(undefined);
                if (store.selectedSession?.uniqueSessionId === session.id) open(parquetSession(parquet.index), false, parquet);
                return;
              }
              const document = await getSession(session.id);
              if (!document) throw new Error("This session is no longer in the browser library.");
              await saveSession({ ...document, name });
              await refresh();
              setRename(undefined);
              if (store.selectedSession?.uniqueSessionId === session.id) open(normalizeSession({ ...document, name }));
              setNotice("Session renamed.");
            });
          }}>
            <label>Session name <input value={rename.name} maxLength={160}
              onChange={e => setRename({ id: session.id, name: e.target.value })} /></label>
            <button type="submit" disabled={busy}>Save name</button>
            <button type="button" onClick={() => setRename(undefined)}>Cancel</button>
          </form>}
          {removeId === session.id && <div className={styles.actions}>
            <span>Remove this session from the browser? Export it first if you need a copy.</span>
            <button type="button" disabled={busy} onClick={() => run(async () => {
              await deleteSession(session.id);
              try { localStorage.removeItem(`racehub:selection:${session.id}`); } catch { /* The recording is already removed. */ }
              await refresh();
              if (store.selectedSession?.uniqueSessionId === session.id) {
                onClear();
                dispatch({ type: SELECT_SESSION, session: undefined });
                dispatch({ type: LOAD_PARTICIPANTS_FILE, participants: [] });
                setCurrent(undefined);
                setCurrentParquet(undefined);
                setUnsavedComparison(false);
              }
              setRemoveId(undefined);
              setNotice("Session removed from this browser.");
            })}>Remove from browser</button>
            <button type="button" onClick={() => setRemoveId(undefined)}>Cancel</button>
          </div>}
        </li>)}
      </ul>
    </section>
  );
}
