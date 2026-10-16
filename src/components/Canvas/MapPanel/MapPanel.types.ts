import { TelemetryData } from "../../../modules/race/types";

export interface Props {
  laps: TelemetryData[];
  title: string;
}

export type MapStateProps = Pick<Props, "laps">;
