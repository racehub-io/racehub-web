import React from "react";
import { SELECT_COLOR, SELECT_PRIMARY_LAP, TRIGGER_LAP_SELECTION } from "../../../../modules/race/actions";
import { useDispatch, useStore } from "../../../../modules/context";
import { Props } from "./LapSelector.types";
import styles from "./LapSelector.module.scss";

function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Time not recorded";
  const millis = Math.round(seconds * 1000);
  return `${Math.floor(millis / 60000)}:${String(Math.floor(millis / 1000) % 60).padStart(2, "0")}.${String(millis % 1000).padStart(3, "0")}`;
}

export function LapSelector({ lap, lapNumber }: Props) {
  const { store } = useStore();
  const { dispatch } = useDispatch();
  const selected = !!store.selectedLaps[lap.lapId];
  const name = lap.participant?.name || "Driver not recorded";
  const lapLabel = lapNumber === undefined ? "Lap number not recorded" : `Lap ${lapNumber}`;
  const label = `${name}, ${lapLabel.toLowerCase()}`;
  return (
    <div className={styles.localLap}>
      <button type="button" aria-pressed={selected} aria-label={`Select ${label}`}
        className={selected ? styles.selectedLap : styles.selectLap}
        onClick={() => dispatch({ type: TRIGGER_LAP_SELECTION, lap })}>
        <span>{lapLabel} - {name}</span>
        <strong>{!lap.isComplete && "Recorded part: "}{duration(lap.isComplete && lap.lapTime !== undefined ? lap.lapTime / 1000 : lap.endTime - lap.startTime)}</strong>
        {[lap.sector1Time, lap.sector2Time, lap.sector3Time].some(value => value !== undefined) &&
          <span>{[lap.sector1Time, lap.sector2Time, lap.sector3Time].map((value, index) =>
            `S${index + 1}: ${value === undefined ? "not recorded" : duration(value / 1000)}`).join(" · ")}</span>}
        {!lap.isComplete && <span>Incomplete</span>}
        {!lap.isValid && <span>Invalid</span>}
        {lap.isInLap && <span>In lap</span>}
        {lap.isOutLap && <span>Out lap</span>}
      </button>
      {selected && <div className={styles.lapControls}>
        <button type="button" aria-pressed={store.primaryLapId === lap.lapId}
          onClick={() => dispatch({ type: SELECT_PRIMARY_LAP, primaryLapId: lap.lapId })}>
          {store.primaryLapId === lap.lapId ? "Reference lap" : "Use as reference"}
        </button>
        <label>Colour <input type="color" aria-label={`Colour for ${label}`}
          value={store.selectedLapsColors[lap.lapId] || "#67e8b1"}
          onChange={e => dispatch({ type: SELECT_COLOR, lapId: lap.lapId, color: e.target.value })} /></label>
      </div>}
    </div>
  );
}
