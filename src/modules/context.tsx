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

export interface SelectedLaps {
  [lapId: string]: Lap;
}

export interface SelectedLapsColors {
  [lapId: string]: string;
}

interface State {
  analysisAxis: "distance" | "time";
  selectedSession?: Session;
  selectedLaps: SelectedLaps;
  selectedLapsColors: SelectedLapsColors;
  isParsing: boolean;
  user?: { uid?: string; displayName?: string; email?: string; photoURL?: string };
  participants: any;
  domain: any;
  tooltipCoordinate: any;
  primarySelectedLap: any;
  primaryLapId: string | undefined;
  wsStatus: number;
  recorderInfo: any;
}

export const initialState: State = {
  analysisAxis: "distance",
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
    case "SET_ANALYSIS_AXIS": {
      return { ...state, analysisAxis: action.axis === "time" ? "time" : "distance",
        domain: undefined, tooltipCoordinate: undefined };
    }
    case WS_NEW_STATUS: {
      return { ...state, wsStatus: action.wsStatus };
    }

    case SELECT_SESSION: {
      const { session } = action;
      const laps: Lap[] = session?.localLaps || [];
      const firstLap = laps.find((lap: Lap) => lap.isComplete && lap.isValid) || (action.live ? laps[laps.length - 1] : undefined);
      if (action.live && session?.uniqueSessionId === state.selectedSession?.uniqueSessionId) {
        const selectedLaps: SelectedLaps = {};
        for (const lap of laps) if (state.selectedLaps[lap.lapId]) selectedLaps[lap.lapId] = lap;
        if (!Object.keys(selectedLaps).length && firstLap) selectedLaps[firstLap.lapId] = firstLap;
        const primaryLapId = state.primaryLapId && selectedLaps[state.primaryLapId]
          ? state.primaryLapId : Object.keys(selectedLaps)[0];
        return { ...state, selectedSession: session, selectedLaps, primaryLapId,
          selectedLapsColors: { ...(firstLap ? { [firstLap.lapId]: "#67e8b1" } : {}), ...state.selectedLapsColors } };
      }
      const selectedLaps: SelectedLaps = {};
      const selectedLapsColors: SelectedLapsColors = {};
      const saved = action.selection;
      if (Array.isArray(saved?.lapIds)) {
        for (const lap of laps) if (saved.lapIds.includes(lap.lapId)) {
          selectedLaps[lap.lapId] = lap;
          const color = saved.colors?.[lap.lapId];
          selectedLapsColors[lap.lapId] = typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#67e8b1";
        }
      }
      if (!Object.keys(selectedLaps).length && firstLap) {
        selectedLaps[firstLap.lapId] = firstLap;
        selectedLapsColors[firstLap.lapId] = "#67e8b1";
      }
      return {
        ...state,
        selectedSession: session,
        selectedLaps,
        selectedLapsColors,
        primaryLapId: selectedLaps[saved?.primaryLapId] ? saved.primaryLapId : Object.keys(selectedLaps)[0],
        analysisAxis: saved?.axis === "time" || saved?.axis === "distance" ? saved.axis : state.analysisAxis,
        primarySelectedLap: {},
        domain: undefined,
        tooltipCoordinate: undefined,
      };
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
      return state.selectedLaps[action.primaryLapId]
        ? { ...state, primaryLapId: action.primaryLapId }
        : state;
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
          newState.primaryLapId = Object.keys(selectedLaps)[0];
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
          [lap.lapId]: ["#67e8b1", "#ffbf69", "#79b8ff", "#e9a7ff", "#ff8a95"][Object.keys(state.selectedLaps).length % 5],
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
  React.useEffect(() => {
    const id = state.selectedSession?.uniqueSessionId;
    if (!id || id.startsWith("live-")) return;
    try {
      localStorage.setItem(`racehub:selection:${id}`, JSON.stringify({ lapIds: Object.keys(state.selectedLaps),
        colors: state.selectedLapsColors, primaryLapId: state.primaryLapId, axis: state.analysisAxis }));
    } catch { /* Session files remain available when preference storage is full. */ }
  }, [state.selectedSession, state.selectedLaps, state.selectedLapsColors, state.primaryLapId, state.analysisAxis]);
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
