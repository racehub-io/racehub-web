import React from "react";
import { MapPanel } from "./MapPanel";
import { SessionPanel } from "./SessionPanel";
import { UserPanel } from "./UserPanel";
import { Recorder } from "./Recorder";
import { Panel } from "./Canvas.types";
import { Explorer } from "./Explorer";
import { LineChartPanel } from "./LineChartPanel";
import { browserOnly } from "../../runtime";

export const layout = {
  lg: [
    {
      i: "user-panel",
      x: 0,
      y: 0,
      w: 12,
      h: 1,
      static: true,
      resizeHandles: [],
    },
    { i: "explorer-panel", x: 0, y: 1, w: browserOnly ? 9 : 6, h: 3 },
    { i: "recorder-panel", x: 9, y: 1, w: 3, h: 3 },
    {
      i: "session-panel",
      x: 0,
      y: 4,
      w: 2,
      h: 21,
    },
    { i: "map-panel", x: browserOnly ? 9 : 6, y: 1, w: 3, h: 3 },
    {
      i: "bar-graph-brush",
      x: 2,
      y: 4,
      w: 10,
      h: 3,
      resizeHandles: [],
    },
    { i: "bar-graph-1", x: 2, y: 7, w: 10, h: 3 },
    { i: "bar-graph-2", x: 2, y: 10, w: 10, h: 3 },
    { i: "bar-graph-3", x: 2, y: 13, w: 10, h: 3 },
    { i: "bar-graph-4", x: 2, y: 16, w: 10, h: 3 },
    { i: "bar-graph-5", x: 2, y: 19, w: 10, h: 3 },
    { i: "bar-graph-6", x: 2, y: 22, w: 10, h: 3 },
  ].filter(panel => !browserOnly || panel.i !== "recorder-panel"),
};

export const canvasSetup: Panel[] = [
  { component: <UserPanel />, id: "user-panel" },
  {
    component: <SessionPanel />,
    id: "session-panel",
    showScrollHint: true,
  },
  {
    component: <Explorer title="Telemetry Explorer" />,
    id: "explorer-panel",
    showScrollHint: true,
  },
  ...(!browserOnly ? [{
    component: <Recorder title="Recorder" />,
    id: "recorder-panel",
    showScrollHint: true,
  }] : []),
  { component: <MapPanel title="Map" />, id: "map-panel" },
  {
    component: <LineChartPanel parameter="speed" title="Lap delta (s)" brush />,
    id: "bar-graph-brush",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="throttle" title="Channel chart 1" />,
    id: "bar-graph-1",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="brake" title="Channel chart 2" />,
    id: "bar-graph-2",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="steer" title="Channel chart 3" />,
    id: "bar-graph-3",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="speed" title="Channel chart 4" />,
    id: "bar-graph-4",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="gear" title="Channel chart 5" />,
    id: "bar-graph-5",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="engine_rpm" title="Channel chart 6" />,
    id: "bar-graph-6",
    showScrollHint: true,
  },
];
