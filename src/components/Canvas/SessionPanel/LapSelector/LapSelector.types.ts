import { Lap } from "../../../../types";

export interface Props {
  lap: Lap;
  lapNumber: number;
  displayDriverName: boolean;
  uniqueSessionId: string;
  onLapSelection: (
    sessionId: string,
    userId: string,
    participantId: string
  ) => void;
}

export type MapDispatchProps = Pick<Props, "onLapSelection">;
