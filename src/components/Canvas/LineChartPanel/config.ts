import { bisector } from "d3-array";
import { TelemetryData } from "../../../modules/race/types";

export const PLOT_CONFIG = [
  {
    parameter: "m_throttle",
    name: "Throttle",
    axis: "left",
    color: "#00d78f",
    top: 100,
    bottom: 10,
  },
];

export const CHART_HEIGHT = 170;
export const CHART_WIDTH = 2000;
export const BRUSH_MARGIN = { top: 0, bottom: 0, left: 0, right: 0 };
export const RELATIVE_BRUSH_HEIGHT = PLOT_CONFIG[0].top - PLOT_CONFIG[0].bottom;
export const BRUSH_HEIGHT = (CHART_HEIGHT * RELATIVE_BRUSH_HEIGHT) / 100;

// sessiondata -> m_trackLength  // Track length in metres
// lapdata     -> m_carPosition  // Car race position
// lapdata     -> m_lapDistance  // Distance vehicle is around current lap in metres – could
//                                  be negative if line hasn’t been crossed yet

export const bisectLapDistance = bisector<any, any>((d) => d.lap_distance).left;
export const getX = (d: TelemetryData) => d.lap_distance;
export const tickLabelProps = () =>
  ({
    fill: "#8a96ae",
    fontSize: 12,
    fontFamily: "sans-serif",
    textAnchor: "middle",
  } as const);
