import { TelemetryData } from "../../modules/race/types";

export interface Panel {
  id: string;
  component: JSX.Element;
  showScrollHint?: boolean;
}

export interface Props {
  laps: TelemetryData[];
  onLoadUser: (userId: string) => void;
  onLoadSession: (sessionId: string, userId: string) => void;
}
