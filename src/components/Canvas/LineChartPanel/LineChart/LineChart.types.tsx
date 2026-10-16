import { TelemetryData } from "../../../../modules/race/types";
import { Tooltip } from "../LineChartPanel.types";

export interface Props {
  index: number;
  filteredRecords: TelemetryData[];
  color: string;
  handleTooltip: any;
  parent: any;
  tooltip: Tooltip | undefined;
  hideTooltip: any;
  parameter: string;
  scaleRecords: TelemetryData[];
  lapId: string;
}
