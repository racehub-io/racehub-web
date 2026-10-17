import React, { useEffect, useMemo, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { Props } from "./MapPanel.types";
import styles from "./MapPanel.module.scss";
import { useStore } from "../../../modules/context";
import { AnalysisRow, axisValue, channelRows, finite, lapRows, numericExtent } from "../LineChartPanel/analysis";

export function MapPanel({ laps }: Props) {
  const { store } = useStore();
  const { selectedLaps, selectedLapsColors, tooltipCoordinate, domain, analysisAxis } = store;
  const axis = analysisAxis === "time" ? "time" : "distance";
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const tracks = useMemo(() => Object.values(selectedLaps).map(lap => {
    const groups: AnalysisRow[][] = [];
    let group: AnalysisRow[] = [];
    channelRows(lapRows(laps, lap), "world_x").forEach(row => {
      if (finite(row.world_x) && finite(row.world_z)) group.push(row);
      else { if (group.length) groups.push(group); group = []; }
    });
    if (group.length) groups.push(group);
    return { lap, groups: groups.map(points => {
      const step = Math.max(1, Math.ceil(points.length / 1600));
      return points.filter((row, index) => index % step === 0 || index === points.length - 1);
    }) };
  }), [laps, selectedLaps]);
  const rows = useMemo(() => tracks.flatMap(track => track.groups.flat()), [tracks]);
  const xExtent = useMemo(() => numericExtent(rows.map(row => row.world_x as number)), [rows]);
  const yExtent = useMemo(() => numericExtent(rows.map(row => -(row.world_z as number))), [rows]);
  const move = (x: number, y: number) => setPan(value => ({ x: value.x + x / zoom, y: value.y + y / zoom }));
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [store.selectedSession?.uniqueSessionId]);

  if (!xExtent || !yExtent) return <p className={styles.empty} role="status">
    {tracks.length ? "Track map is unavailable. These laps have no recorded world coordinates." : "Select a lap to show its recorded track path."}
  </p>;

  const spanX = Math.max(xExtent[1] - xExtent[0], 1);
  const spanY = Math.max(yExtent[1] - yExtent[0], 1);
  const centerX = (xExtent[0] + xExtent[1]) / 2 + pan.x * spanX;
  const centerY = (yExtent[0] + yExtent[1]) / 2 + pan.y * spanY;
  const cursor = finite(tooltipCoordinate) ? tooltipCoordinate : undefined;
  return <div className={styles.panel}>
    <div className={styles.map}>
      <ParentSize>{parent => {
        const ratio = Math.max(parent.width, 1) / Math.max(parent.height, 1);
        const viewWidth = Math.max(spanX, spanY * ratio) * 1.1 / zoom;
        const viewHeight = viewWidth / ratio;
        const radius = viewWidth / Math.max(parent.width, 1) * 4;
        return <svg width={parent.width} height={parent.height}
          viewBox={`${centerX - viewWidth / 2} ${centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`}
          role="img" aria-label="Recorded track paths in world coordinates">
          {tracks.map(track => {
            const color = selectedLapsColors[track.lap.lapId] || "#ffffff";
            const coordinates = track.groups.flat();
            const cursorRows = coordinates.filter(row => finite(axisValue(row, axis)));
            const range = numericExtent(cursorRows.map(row => axisValue(row, axis) as number));
            const nearest = cursor !== undefined && range && cursor >= range[0] && cursor <= range[1] ?
              cursorRows.reduce<AnalysisRow | undefined>((best, row) => !best ||
                Math.abs((axisValue(row, axis) as number) - cursor) < Math.abs((axisValue(best, axis) as number) - cursor) ? row : best, undefined) : undefined;
            return <g key={track.lap.lapId}>
              {track.groups.map((sampled, index) => {
                return <g key={index}>
                  <polyline points={sampled.map(row => `${row.world_x},${-(row.world_z as number)}`).join(" ")}
                    fill="none" stroke={color} strokeOpacity={domain ? 0.3 : 1} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  {sampled.filter(row => {
                    const x = axisValue(row, axis);
                    return x !== undefined && domain && x >= domain.x0 && x <= domain.x1;
                  }).map((row, pointIndex) => <circle key={pointIndex} cx={row.world_x} cy={-(row.world_z as number)} r={radius / 2} fill={color} />)}
                  {sampled.length === 1 && <circle cx={sampled[0].world_x} cy={-(sampled[0].world_z as number)} r={radius / 2} fill={color} />}
                </g>;
              })}
              {nearest && <circle cx={nearest.world_x} cy={-(nearest.world_z as number)} r={radius} fill={color} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke">
                <title>{track.lap.participant?.name || track.lap.participantId}: {cursor?.toFixed(2)} {axis === "time" ? "s" : "m"}</title>
              </circle>}
            </g>;
          })}
        </svg>;
      }}</ParentSize>
    </div>
    <div className={styles.controls} aria-label="Track map controls">
      <button type="button" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(16, value * 1.25))}>+</button>
      <button type="button" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(0.25, value / 1.25))}>-</button>
      <button type="button" aria-label="Pan left" onClick={() => move(-0.1, 0)}>←</button>
      <button type="button" aria-label="Pan up" onClick={() => move(0, -0.1)}>↑</button>
      <button type="button" aria-label="Pan down" onClick={() => move(0, 0.1)}>↓</button>
      <button type="button" aria-label="Pan right" onClick={() => move(0.1, 0)}>→</button>
      <button type="button" onClick={reset}>Fit track</button>
    </div>
    {tracks.some(track => !track.groups.length) && <span className={styles.empty}>World coordinates are unavailable for some selected laps.</span>}
  </div>;
}
