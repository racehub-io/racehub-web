import React from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../../modules/context";
import styles from "./UserPanel.module.scss";

export function UserPanel() {
  const { store } = useStore();

  const getWSIndicator = () => {
    switch (store.wsStatus) {
      case WebSocket.OPEN:
        return "#00d78f";
      case WebSocket.CLOSED:
        return "#D81E5B";
      case WebSocket.CLOSING:
      case WebSocket.CONNECTING:
        return "#EE6C4D";
      default:
        return;
    }
  };

  const getWSLabel = () => {
    switch (store.wsStatus) {
      case WebSocket.OPEN:
        return "Connected";
      case WebSocket.CLOSED:
        return "Disconnected";
      case WebSocket.CLOSING:
        return "Disconnecting...";
      case WebSocket.CONNECTING:
        return "Connecting...";
      default:
        return;
    }
  };

  return (
    <div className={styles.userPanel}>
      <Link to="/" className={styles.unlink}>
        <div className={styles.raceHub}>
          <span className={styles.title}>RaceHub</span>
          <span className={styles.subtitle}>ALPHA</span>
        </div>
      </Link>
      <div className={styles.indicatorWrapper}>
        <div
          className={styles.indicator}
          style={{ backgroundColor: getWSIndicator() }}
        />
        Client: {getWSLabel()}
      </div>
    </div>
  );
}
