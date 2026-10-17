import React from "react";
import { Link } from "react-router-dom";
import styles from "./Home.module.scss";
import { browserOnly, licensingUrl, setupGuideUrl, sourceCodeUrl } from "../../runtime";

export function Home() {
  return (
    <main className={styles.localHome}>
      <p className={styles.eyebrow}>FREE AND OPEN SOURCE</p>
      <h1>Understand your laps.</h1>
      <p>Analyse F1, iRacing, and rFactor 2 telemetry on your computer.</p>
      <p>No account or RaceHub subscription is required.</p>
      <p>Import a recording. Compare laps. Find where you gain and lose time.</p>
      <Link className={styles.openAnalyser} to="/analyser">Open the analyser</Link>
      <section aria-label="Local analysis">
        <h2>Your recordings stay local.</h2>
        <ul>
          <li>{browserOnly ? "Imported files stay in this browser." : "Imported sessions stay in this browser. Native recordings stay on your recorder's disk."}</li>
          <li>Export your recordings to keep a separate copy.</li>
          <li>{browserOnly ? "Record telemetry with the local RaceHub tools. Then import your saved files here."
            : "Use the optional native recorder to save Parquet files at the rate sent by the game."}</li>
        </ul>
        <p>{browserOnly ? "This hosted app analyses files. Use the local setup for offline access and telemetry recording."
          : "Run RaceHub locally, or host the web app yourself. No cloud service is required."}</p>
        {browserOnly && <p>Matching local source uses <code>telemetry/local-platform</code> until the pull requests merge.
          The setup guide covers all three repositories.</p>}
        <p><a href={setupGuideUrl}>Setup guide</a>{" · "}
          <a href={sourceCodeUrl}>Source code</a>{" · "}
          <a href={licensingUrl}>Licensing</a></p>
      </section>
    </main>
  );
}
