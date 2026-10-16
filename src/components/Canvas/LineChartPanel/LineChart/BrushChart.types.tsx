import { Tooltip } from "../LineChartPanel.types";

export interface Props {
  color: string;
  index: number;
  records: any;
  scaleRecords: any;
  deltaTimes: any;
  deltaTimeRange: [number, number];
  parent: any;
  parameter: string;
  tooltip: Tooltip | undefined;
  lapId: string;
}
