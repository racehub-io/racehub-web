import { TelemetryData } from "../../../modules/race/types";

export interface Props {
  laps: TelemetryData[];
  parameter: string;
  brush?: boolean;
  title?: string;
}

export interface Tooltip {
  lapDistance: number;
  tooltipLeft: number;
  tooltipTop: any;
  tooltipData: any;
  parameter: string;
  relativeTop: number;
}

export type MapStateProps = Pick<Props, "laps">;
