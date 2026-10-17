import React, { useState } from "react";
import { LapSelector } from "./LapSelector";
import { useStore } from "../../../modules/context";
import styles from "./SessionPanel.module.scss";

export function SessionPanel() {
  const { store } = useStore();
  const [order, setOrder] = useState("number");
  const session = store.selectedSession;
  const laps = [...(session?.localLaps || [])];
  if (!session) return <p>Open a session to choose laps.</p>;
  laps.sort((a, b) => order === "time"
    ? (a.lapTime ?? (a.endTime - a.startTime) * 1000) - (b.lapTime ?? (b.endTime - b.startTime) * 1000)
    : a.participantId.localeCompare(b.participantId) || (a.lapNumber || 0) - (b.lapNumber || 0));
  return (
    <section className={styles.sessionPanel} aria-label="Laps">
      <h2>{session.trackName || "Track not recorded"}</h2>
      <p>{session.name || "Local session"}</p>
      <label>Sort laps <select value={order} onChange={e => setOrder(e.target.value)}>
        <option value="number">Driver and lap</option><option value="time">Lap time</option>
      </select></label>
      {laps.length === 0 && <p>No laps were found in this recording.</p>}
      <div className={styles.lapsWrapper}>
        {laps.map(lap => <LapSelector key={lap.lapId} lap={lap}
          lapNumber={lap.lapNumber} displayDriverName
          uniqueSessionId={session.uniqueSessionId} />)}
      </div>
    </section>
  );
}
