import React from "react";
import {
  DOMAIN_SELECTION,
  TRIGGER_LAP_SELECTION,
  LOAD_PARTICIPANTS_FILE,
  SELECT_PARTICIPANTS,
  START_LOAD_RACE_FILE,
  END_LOAD_RACE_FILE,
  RESET_SELECTED_PARTICIPANTS,
  LOAD_USER,
  UPDATE_UPLOAD_STATUS,
  END_PARSING,
  STARTS_PARSING,
  SELECT_SESSION,
  SIGN_OUT_USER,
  TRIGGER_TOOLTIP,
  SELECT_PRIMARY_LAP,
  SELECT_COLOR,
  WS_NEW_STATUS,
  RECORDER_STATUS,
} from "../modules/race/actions";
import { Lap, Session } from "../types";
import firebase from "firebase";

export enum UploadStatus {
  NotStarted = 0,
  Starting,
  Uploading,
  Parsing,
}

interface RootState {
  dispatch: React.Dispatch<any>;
  state: State;
}

export interface SelectedLaps {
  [lapId: string]: Lap;
}

export interface SelectedLapsColors {
  [lapId: string]: string;
}

interface State {
  selectedSession?: Session;
  selectedLaps: SelectedLaps;
  selectedLapsColors: SelectedLapsColors;
  isParsing: boolean;
  user?: firebase.User;
  participants: any;
  domain: any;
  tooltipCoordinate: any;
  primarySelectedLap: any;
  primaryLapId: string | undefined;
  wsStatus: number;
  recorderInfo: any;
}

export const initialState: State = {
  selectedSession: undefined,
  selectedLaps: {},
  selectedLapsColors: {},
  user: undefined,
  participants: [],
  primaryLapId: undefined,
  isParsing: false,
  domain: undefined,
  tooltipCoordinate: undefined,
  primarySelectedLap: {},
  wsStatus: WebSocket.CLOSED,
  recorderInfo: {},
};

export function UIReducer(state: State, action: any): any {
  switch (action.type) {
    case WS_NEW_STATUS: {
      return { ...state, wsStatus: action.wsStatus };
    }

    case SELECT_SESSION: {
      const { session } = action;
      return { ...state, selectedSession: session };
    }

    case DOMAIN_SELECTION: {
      const { domain } = action;
      return { ...state, domain };
    }

    case UPDATE_UPLOAD_STATUS: {
      const { uploadStatus } = action;
      return { ...state, uploadStatus };
    }

    case START_LOAD_RACE_FILE: {
      return { ...state, loadingRaceFile: true };
    }

    case END_LOAD_RACE_FILE: {
      return { ...initialState };
    }

    case LOAD_USER: {
      return { ...state, user: { ...action.user } };
    }

    case RECORDER_STATUS: {
      return { ...state, recorderInfo: action.payload }
    }

    case SELECT_COLOR: {
      const { lapId, color } = action;
      return {
        ...state,
        selectedLapsColors: { ...state.selectedLapsColors, [lapId]: color },
      };
    }

    case SIGN_OUT_USER: {
      return { ...state, user: undefined };
    }

    case SELECT_PRIMARY_LAP: {
      if (state.primaryLapId === action.primaryLapId) {
        return { ...state, primaryLapId: undefined };
      }

      return { ...state, primaryLapId: action.primaryLapId };
    }

    case TRIGGER_TOOLTIP: {
      if (state.tooltipCoordinate === action.coordinate) {
        return state;
      }
      return { ...state, tooltipCoordinate: action.coordinate };
    }

    case TRIGGER_LAP_SELECTION: {
      const { lap } = action;

      // unselect
      if (state.selectedLaps[lap.lapId]) {
        const { [lap.lapId]: _unused, ...selectedLaps } = state.selectedLaps;
        let newState = { ...state, selectedLaps };

        if (state.primaryLapId === lap.lapId) {
          newState.primaryLapId = undefined;
        }

        return newState;
      }

      // select
      let newState: {
        selectedLaps: SelectedLaps;
        selectedLapsColors: SelectedLapsColors;
        primaryLapId?: string;
      } = {
        selectedLaps: { ...state.selectedLaps, [lap.lapId]: lap },
        selectedLapsColors: {
          ...state.selectedLapsColors,
          [lap.lapId]: "white",
        },
      };

      // sets primary lap id
      if (Object.keys(state.selectedLaps).length === 0 || !state.primaryLapId) {
        newState.primaryLapId = lap.lapId;
      }

      return {
        ...state,
        ...newState,
      };
    }

    case LOAD_PARTICIPANTS_FILE: {
      const { participants } = action;
      return {
        ...state,
        participants,
      };
    }

    case RESET_SELECTED_PARTICIPANTS: {
      return { ...state, selectedParticipants: [], selectedLaps: {} };
    }

    case SELECT_PARTICIPANTS: {
      return {
        ...state,
        participants: [],
        selectedParticipants: action.selectedParticipants,
      };
    }

    case STARTS_PARSING: {
      return { ...state, isParsing: true };
    }

    case END_PARSING: {
      return { ...state, isParsing: false };
    }

    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}

export const UIContext = React.createContext({
  dispatch: (value: any) => {},
  state: initialState,
});

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(UIReducer, initialState);
  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
}

export function useStore(): { store: State } {
  const context = React.useContext(UIContext);
  return { store: context.state };
}

export function useDispatch() {
  const context = React.useContext(UIContext);
  return { dispatch: context.dispatch };
}
