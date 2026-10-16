import { Dispatch } from "redux";
import { LoadRaceFile, ResetRaceFile } from "../../../modules/race/actions";
import { User } from "../../../types";

export interface Props {
  laps: any;
  session: any;
  participants: any;
  user?: User;
  title?: string;
  onResetRaceFile: () => any;
  onLoadRaceFile: (lapData: any) => any;
}

export type MapStateProps = Pick<
  Props,
  "user" | "laps" | "session" | "participants"
>;

export type MapDispatchProps = Pick<
  Props,
  "onResetRaceFile" | "onLoadRaceFile"
>;

export type MapDispatch = Dispatch<LoadRaceFile | ResetRaceFile>;
