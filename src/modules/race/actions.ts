import { action } from "typesafe-actions";
import { Session } from "../../types";

export const FETCH_SESSION_REQUEST = "Fetch Session Request";
export const FETCH_SESSION_SUCCESS = "Fetch Session Success";
export const FETCH_SESSION_FAILURE = "Fetch Session Failure";
export const FETCH_USER_REQUEST = "Fetch User Request";
export const FETCH_USER_SUCCESS = "Fetch User Success";
export const FETCH_USER_FAILURE = "Fetch User Failure";
export const FETCH_LAP_REQUEST = "Fetch Lap Request";
export const FETCH_LAP_SUCCESS = "Fetch Lap Success";
export const FETCH_LAP_FAILURE = "Fetch Lap Failure";
export const FETCH_TELEMETRY_REQUEST = "Fetch Telemetry Request";
export const TRIGGER_LAP_SELECTION = "Trigger Lap Selection";
export const LOAD_RACE_FILE = "Load Race File";
export const TRIGGER_TOOLTIP = "Trigger Tooltip";
export const DOMAIN_SELECTION = "Domain Selection";
export const SELECT_PRIMARY_LAP = "Select Primary Lap";
export const SELECT_COLOR = "Select Color";
export const UPDATE_UPLOAD_STATUS = "Update Upload Status";
export const START_LOAD_RACE_FILE = "Start Load Race File";
export const END_LOAD_RACE_FILE = "End Load Race File";
export const LOAD_PARTICIPANTS_FILE = "Load Participants File";
export const RESET_RACE_FILE = "Reset Race File";
export const SELECT_SESSION = "Select Session";
export const SELECT_PARTICIPANTS = "Select Participants";
export const RESET_SELECTED_PARTICIPANTS = "Reset Selected Participants";
export const LOAD_USER = "Load User";
export const SIGN_OUT_USER = "Sign Out User";
export const STARTS_PARSING = "Starts Parsing";
export const END_PARSING = "End Parsing";
export const WS_NEW_STATUS = "WS New Status";
export const WRITE_PARQUET_META = 'WRITE_PARQUET_META';
export const RECORDER_STATUS = 'RECORDER_STATUS';

export const fetchTelemetryRequest = (
  uniqueSessionId: string,
  userId: string,
  participantId: string
) =>
  action(FETCH_TELEMETRY_REQUEST, {
    uniqueSessionId,
    userId,
    participantId,
  });
// export const fetchSessionRequest = (session: Session) =>
//   action(FETCH_SESSION_REQUEST, { session });
export const fetchSessionSuccess = (session: any) =>
  action(FETCH_SESSION_SUCCESS, { session });
export const fetchSessionFailure = (error: any) =>
  action(FETCH_SESSION_FAILURE, { error });
export const fetchLapRequest = (lapID: string) =>
  action(FETCH_LAP_REQUEST, { lapID });
export const fetchLapSuccess = (lap: any) => action(FETCH_LAP_SUCCESS, { lap });
export const fetchLapFailure = (error: any) =>
  action(FETCH_LAP_FAILURE, { error });
export const fetchUserRequest = (userId: string) =>
  action(FETCH_USER_REQUEST, { userId });
export const fetchUserSuccess = (user: any) =>
  action(FETCH_USER_SUCCESS, { user });
export const fetchUserFailure = (error: any) =>
  action(FETCH_USER_FAILURE, { error });
export const loadRaceFile = (raceFile: any) =>
  action(LOAD_RACE_FILE, { raceFile });
export const resetRaceFile = () => action(RESET_RACE_FILE);

export type ResetRaceFile = ReturnType<typeof resetRaceFile>;
export type LoadRaceFile = ReturnType<typeof loadRaceFile>;
export type FetchSessionSuccess = ReturnType<typeof fetchSessionSuccess>;
export type FetchLapSuccess = ReturnType<typeof fetchLapSuccess>;
export type FetchUserSuccess = ReturnType<typeof fetchUserSuccess>;
