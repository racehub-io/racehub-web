import { Lap } from "../../../../types";

export interface Props {
  lap: Lap;
  lapNumber?: number;
  displayDriverName: boolean;
  uniqueSessionId: string;
}
