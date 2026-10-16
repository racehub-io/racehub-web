import React from "react";
import { MapPanel } from "./MapPanel";
import { SessionPanel } from "./SessionPanel";
import { UserPanel } from "./UserPanel";
import { Recorder } from "./Recorder";
import { Panel } from "./Canvas.types";
import { Explorer } from "./Explorer";
import { LineChartPanel } from "./LineChartPanel";

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
    { i: "explorer-panel", x: 0, y: 1, w: 6, h: 3 },
    { i: "recorder-panel", x: 9, y: 1, w: 3, h: 3 },
    {
      i: "session-panel",
      x: 0,
      y: 4,
      w: 2,
      h: 15,
    },
    { i: "map-panel", x: 6, y: 1, w: 3, h: 3 },
    {
      i: "bar-graph-brush",
      x: 4,
      y: 4,
      w: 10,
      h: 2,
      resizeHandles: [],
    },
    { i: "bar-graph-1", x: 4, y: 7, w: 10, h: 3 },
    { i: "bar-graph-2", x: 4, y: 10, w: 10, h: 3 },
    { i: "bar-graph-3", x: 4, y: 13, w: 10, h: 3 },
    { i: "bar-graph-4", x: 4, y: 16, w: 10, h: 3 },
  ],
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
  {
    component: <Recorder title="Recorder" />,
    id: "recorder-panel",
    showScrollHint: true,
  },
  { component: <MapPanel title="Map" />, id: "map-panel" },
  {
    component: <LineChartPanel parameter="speed" brush />,
    id: "bar-graph-brush",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="throttle" title="Throttle" />,
    id: "bar-graph-1",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="brake" title="Brake" />,
    id: "bar-graph-2",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="steer" title="Steer" />,
    id: "bar-graph-3",
    showScrollHint: true,
  },
  {
    component: <LineChartPanel parameter="speed" title="Speed" />,
    id: "bar-graph-4",
    showScrollHint: true,
  },
];
