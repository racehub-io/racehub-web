import React, { useMemo, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { DOMAIN_SELECTION, TRIGGER_TOOLTIP } from "../../../modules/race/actions";
import { useDispatch, useStore } from "../../../modules/context";
import { Props } from "./LineChartPanel.types";
import { axisValue, channelSegments, deltaSegments, finite, lapRows, nearestPoint, numericExtent, Point, recordedChannels, samplePoints } from "./analysis";
import styles from "./LineChartPanel.module.scss";

interface ChannelInfo { label: string; unit: string; percent?: boolean; discrete?: boolean }

const CHANNELS: Record<string, ChannelInfo> = {
  speed: { label: "Speed", unit: "km/h" },
  throttle: { label: "Throttle", unit: "%", percent: true },
  brake: { label: "Brake", unit: "%", percent: true },
  steer: { label: "Steering", unit: "ratio" },
  steer_angle: { label: "Steering angle", unit: "°" },
  gear: { label: "Gear", unit: "", discrete: true },
  engine_rpm: { label: "Engine speed", unit: "rpm" },
  lap_time: { label: "Lap time", unit: "ms" },
  last_lap_time: { label: "Last lap time", unit: "ms" },
  current_lap_time: { label: "Current lap time", unit: "s" },
  previous_lap_time: { label: "Previous lap time", unit: "s" },
  lap_distance: { label: "Lap distance", unit: "m" },
  total_distance: { label: "Total distance", unit: "m" },
  track_length: { label: "Track length", unit: "m" },
  tyre_age: { label: "Tyre age", unit: "laps", discrete: true },
  lap_number: { label: "Lap number", unit: "", discrete: true },
  lap_valid: { label: "Lap invalid flag", unit: "state", discrete: true },
  lap_invalid: { label: "Lap invalid flag", unit: "state", discrete: true },
  car_position: { label: "Race position", unit: "", discrete: true },
  drs: { label: "DRS", unit: "state", discrete: true },
  pit_status: { label: "Pit status", unit: "state", discrete: true },
  ers_deploy_mode: { label: "ERS mode", unit: "code", discrete: true },
  tyre_compound: { label: "Tyre compound", unit: "code", discrete: true },
};

function channelDetails(parameter: string, simulator?: string): ChannelInfo {
  if (CHANNELS[parameter]) return CHANNELS[parameter];
  const label = parameter.replace(/_/g, " ").replace(/^./, value => value.toUpperCase());
  let unit = "recorded units";
  if (/^(?:tyres?|brakes?|engine|air|track).*temperature(?:_[a-z]{2})?$/.test(parameter)) unit = "°C";
  else if (/^tyres?_pressure_[a-z]{2}$/.test(parameter)) unit = simulator === "iracing" ? "recorded units" : "psi";
  else if (/^(?:tyres?_wear|tyres?_damage|brake_damage)_[a-z]{2}$/.test(parameter) && simulator === "f1") unit = "%";
  else if (/^world_[xyz]$/.test(parameter)) unit = "m";
  else if (/^g_(?:lateral|longitudinal|vertical)$/.test(parameter)) unit = "g";
  else if (/^ers_.*(?:energy|harvested|deployed)/.test(parameter)) unit = "J";
  else if (/^sector_[123]_time$/.test(parameter)) unit = "ms";
  else if (parameter === "fuel_in_tank" || parameter === "fuel_capacity") unit = simulator === "f1" ? "kg" : simulator === "rfactor2" ? "L" : "recorded units";
  else if (parameter === "clutch") return { label, unit: "%", percent: simulator === "rfactor2" || simulator === "iracing" };
  return { label, unit, discrete: false, percent: false };
}

export function LineChartPanel(props: Props) {
  const { dispatch } = useDispatch();
  const { store } = useStore();
  const { selectedLaps, selectedLapsColors, primaryLapId, domain, tooltipCoordinate, analysisAxis } = store;
  const [dragStart, setDragStart] = useState<number | undefined>();
  const [selectedChannel, setSelectedChannel] = useState(props.parameter);
  const axis = analysisAxis === "time" ? "time" : "distance";
  const axisUnit = axis === "time" ? "s" : "m";
  const rowSets = useMemo(() => Object.values(selectedLaps).map(lap => ({
    lap,
    rows: lapRows(props.laps, lap),
  })), [props.laps, selectedLaps]);
  const channels = useMemo(() => props.brush ? [] : recordedChannels(rowSets.flatMap(entry => entry.rows)), [rowSets, props.brush]);
  const parameter = selectedChannel === "steer" && !channels.includes("steer") && channels.includes("steer_angle") ? "steer_angle" : selectedChannel;
  const channel: ChannelInfo = props.brush ? { label: "Lap delta", unit: "s", percent: false } :
    channelDetails(parameter, store.selectedSession?.simulator);
  const format = (value: number) => `${(channel.percent ? value * 100 : value).toFixed(channel.discrete ? 0 : 2)}${channel.unit ? ` ${channel.unit}` : ""}`;
  const series = useMemo(() => {
    const reference = rowSets.find(entry => entry.lap.lapId === primaryLapId);
    return rowSets.map(entry => ({
      id: entry.lap.lapId,
      label: `${entry.lap.participant?.name || entry.lap.participantId} · Lap ${entry.lap.lapNumber === undefined ? entry.lap.lapId : entry.lap.lapNumber}${entry.lap.isComplete ? "" : " (partial)"}${entry.lap.isValid ? "" : " (invalid)"}`,
      segments: props.brush ? (reference ? deltaSegments(entry.rows, reference.rows, axis) : []) :
        channelSegments(entry.rows, axis, parameter),
    })).map(entry => {
      const total = entry.segments.reduce((count, points) => count + points.length, 0);
      return { ...entry, drawn: entry.segments.map(points => samplePoints(points, Math.max(4, Math.floor(1600 * points.length / total)))) };
    });
  }, [rowSets, primaryLapId, props.brush, parameter, axis]);
  const fullX = useMemo(() => numericExtent(rowSets.flatMap(entry => entry.rows.map(row => axisValue(row, axis)).filter(finite))), [rowSets, axis]);
  const hasData = series.some(entry => entry.segments.length > 0);
  const selectedRange = useMemo(() => !props.brush && domain && finite(domain.x0) && finite(domain.x1) && domain.x0 < domain.x1 ?
    [domain.x0, domain.x1] : fullX && (fullX[0] === fullX[1] ? [fullX[0] - 0.5, fullX[1] + 0.5] : fullX), [props.brush, domain, fullX]);
  const valueExtent = useMemo(() => {
    const values = series.flatMap(entry => entry.segments.flatMap(points => points.filter(point =>
      !selectedRange || point.x >= selectedRange[0] && point.x <= selectedRange[1]).map(point => point.y)));
    return numericExtent(values) || numericExtent(series.flatMap(entry => entry.segments.flatMap(points => points.map(point => point.y))));
  }, [series, selectedRange]);
  const yPadding = valueExtent ? Math.max((valueExtent[1] - valueExtent[0]) * 0.05, valueExtent[0] === 0 ? 0.01 : Math.abs(valueExtent[0]) * 0.01) : 0;
  const yRange = valueExtent ? [valueExtent[0] - yPadding, valueExtent[1] + yPadding] : undefined;
  const cursor = finite(tooltipCoordinate) ? tooltipCoordinate : undefined;
  const setRange = (start: number, end: number) => {
    if (!fullX || !finite(start) || !finite(end)) return;
    const x0 = Math.max(start, fullX[0]);
    const x1 = Math.min(end, fullX[1]);
    if (x0 < x1) dispatch({ type: DOMAIN_SELECTION, domain: { x0, x1 } });
  };

  if (!rowSets.length || !fullX || !selectedRange) {
    return <p className={styles.empty} role="status">{!rowSets.length ? "Select a lap to graph telemetry." :
      props.brush ? "Lap delta is unavailable. Select a reference lap with overlapping distance and lap time data." :
      `${channel.label} is unavailable for the selected laps.`}</p>;
  }

  return <div className={styles.panel}>
    {!props.brush && <div className={styles.controls}>
      <label>Channel <select aria-label={`${props.title || props.parameter} channel`} value={channels.includes(parameter) ? parameter : ""}
        onChange={event => setSelectedChannel(event.currentTarget.value)}>
        {!channels.includes(parameter) && <option value="" disabled>{channel.label} - no recorded values</option>}
        {channels.map(key => {
          const details = channelDetails(key, store.selectedSession?.simulator);
          return <option key={key} value={key}>{details.label}{details.unit ? ` (${details.unit})` : ""}</option>;
        })}
      </select></label>
    </div>}
    {props.brush && <div className={styles.controls}>
      <strong>Lap delta (s)</strong>
      <label>From ({axisUnit}) <input aria-label={`Start ${axisUnit}`} type="number" step="any"
        value={domain?.x0 ?? fullX[0]} onChange={event => setRange(event.currentTarget.valueAsNumber, domain?.x1 ?? fullX[1])} /></label>
      <label>To ({axisUnit}) <input aria-label={`End ${axisUnit}`} type="number" step="any"
        value={domain?.x1 ?? fullX[1]} onChange={event => setRange(domain?.x0 ?? fullX[0], event.currentTarget.valueAsNumber)} /></label>
      <button type="button" onClick={() => dispatch({ type: DOMAIN_SELECTION, domain: undefined })}>Reset range</button>
    </div>}
    <div className={styles.graph}>
      {!hasData || !yRange ? <p className={styles.empty} role="status">{props.brush ?
        "Lap delta is unavailable. Select a reference lap with overlapping distance and lap time data." :
        `${channel.label} is unavailable for the selected laps.`}</p> : <ParentSize>{parent => {
        const width = Math.max(parent.width, 1);
        const height = Math.max(parent.height, 80);
        const left = 56;
        const top = 10;
        const plotWidth = Math.max(width - left - 14, 1);
        const plotHeight = Math.max(height - top - 25, 1);
        const xScale = (x: number) => left + (x - selectedRange[0]) / (selectedRange[1] - selectedRange[0]) * plotWidth;
        const yScale = (y: number) => top + plotHeight - (y - yRange[0]) / (yRange[1] - yRange[0]) * plotHeight;
        const coordinate = (event: React.PointerEvent<SVGRectElement>) => {
          const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
          if (!bounds || !bounds.width) return undefined;
          const ratio = Math.max(0, Math.min(1, ((event.clientX - bounds.left) / bounds.width * width - left) / plotWidth));
          return selectedRange[0] + ratio * (selectedRange[1] - selectedRange[0]);
        };
        const clipId = `clip-${props.brush ? "delta" : props.parameter}`;
        const path = (points: Point[]) => points.map((point, index) =>
          index && channel.discrete && !props.brush ? `H${xScale(point.x)}V${yScale(point.y)}` :
            `${index ? "L" : "M"}${xScale(point.x)},${yScale(point.y)}`).join(" ");
        return <svg width={width} height={height} role="img" aria-label={`${channel.label} in ${channel.unit || "recorded values"} by ${axis === "time" ? "lap time in seconds" : "lap distance in metres"}`}>
          <defs><clipPath id={clipId}><rect x={left} y={top} width={plotWidth} height={plotHeight} /></clipPath></defs>
          {[0, 1, 2, 3, 4].map(index => {
            const fraction = index / 4;
            const y = yRange[0] + fraction * (yRange[1] - yRange[0]);
            const x = selectedRange[0] + fraction * (selectedRange[1] - selectedRange[0]);
            return <g key={index} className={styles.axis}>
              <line x1={left} x2={left + plotWidth} y1={yScale(y)} y2={yScale(y)} />
              <text x={left - 6} y={yScale(y) + 4} textAnchor="end">{(channel.percent ? y * 100 : y).toFixed(channel.discrete ? 0 : 1)}</text>
              <text x={xScale(x)} y={top + plotHeight + 18} textAnchor="middle">{x.toFixed(1)} {axisUnit}</text>
            </g>;
          })}
          <g clipPath={`url(#${clipId})`}>
            {props.brush && domain && <rect x={xScale(domain.x0)} y={top} width={Math.max(0, xScale(domain.x1) - xScale(domain.x0))} height={plotHeight} fill="#387d7a" fillOpacity={0.3} />}
            {series.map(entry => {
              return entry.drawn.map((sampled, index) => {
                const color = selectedLapsColors[entry.id] || "#ffffff";
                return sampled.length === 1 ? <circle key={`${entry.id}-${index}`} cx={xScale(sampled[0].x)} cy={yScale(sampled[0].y)} r={3} fill={color} /> :
                  <path key={`${entry.id}-${index}`} d={path(sampled)} stroke={color} strokeWidth={2} fill="none" />;
              });
            })}
            {cursor !== undefined && <line x1={xScale(cursor)} x2={xScale(cursor)} y1={top} y2={top + plotHeight} stroke="white" strokeDasharray="4 4" />}
          </g>
          <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" tabIndex={0}
            role="slider" aria-label={`${channel.label} chart cursor`} aria-valuemin={selectedRange[0]} aria-valuemax={selectedRange[1]} aria-valuenow={cursor ?? selectedRange[0]}
            onKeyDown={event => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const step = (selectedRange[1] - selectedRange[0]) / 100;
              dispatch({ type: TRIGGER_TOOLTIP, coordinate: Math.max(selectedRange[0], Math.min(selectedRange[1], (cursor ?? selectedRange[0]) + (event.key === "ArrowRight" ? step : -step))) });
            }}
            onPointerDown={event => {
              const x = coordinate(event);
              if (props.brush && x !== undefined) { setDragStart(x); event.currentTarget.setPointerCapture(event.pointerId); }
            }}
            onPointerMove={event => {
              const x = coordinate(event);
              if (x !== undefined) dispatch({ type: TRIGGER_TOOLTIP, coordinate: x });
            }}
            onPointerUp={event => {
              const x = coordinate(event);
              if (dragStart !== undefined && x !== undefined) setRange(Math.min(x, dragStart), Math.max(x, dragStart));
              setDragStart(undefined);
            }}
            onPointerCancel={() => setDragStart(undefined)}
            onPointerLeave={() => { if (dragStart === undefined) dispatch({ type: TRIGGER_TOOLTIP, coordinate: undefined }); }} />
        </svg>;
      }}</ParentSize>}
    </div>
    <div className={styles.legend} aria-live="polite">
      {!props.brush && <span>{channel.label}{channel.unit ? ` (${channel.unit})` : ""}</span>}
      {series.map(entry => {
        const point = cursor === undefined ? undefined : entry.segments.map(points => nearestPoint(points, cursor)).filter((point): point is Point => point !== undefined)
          .reduce<Point | undefined>((best, value) => !best || Math.abs(value.x - cursor) < Math.abs(best.x - cursor) ? value : best, undefined);
        return <span key={entry.id} style={{ color: selectedLapsColors[entry.id] || "#ffffff" }}>
          {entry.label}{point ? `: ${format(point.y)}` : entry.segments.length ? "" : ": unavailable"}
        </span>;
      })}
    </div>
  </div>;
}
