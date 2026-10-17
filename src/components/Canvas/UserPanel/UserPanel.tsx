import React from "react";
import { Link } from "react-router-dom";
import { useDispatch, useStore } from "../../../modules/context";
import styles from "./UserPanel.module.scss";
import { browserOnly } from "../../../runtime";

export function UserPanel() {
  const { store } = useStore();
  const { dispatch } = useDispatch();
  return (
    <header className={styles.userPanel}>
      <Link to="/" className={styles.unlink}><span className={styles.title}>RaceHub</span></Link>
      <span>Free and open source - no account needed</span>
      <label>Chart axis <select value={store.analysisAxis}
        onChange={e => dispatch({ type: "SET_ANALYSIS_AXIS", axis: e.target.value })}>
        <option value="distance">Distance</option><option value="time">Lap time</option>
      </select></label>
      <span>{browserOnly ? "File analysis" : `Recorder: ${store.wsStatus === 1 ? "available" : "unavailable"}`}</span>
    </header>
  );
}
