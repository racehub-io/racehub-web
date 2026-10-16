import { TelemetryData } from "../../../modules/race/types";

export interface Props {
  session?: any;
  participants?: any;
  laps?: TelemetryData[];
  title?: string;
}

export type MapStateProps = Pick<Props, "session" | "participants" | "laps">;
