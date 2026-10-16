import {
  FETCH_SESSION_SUCCESS,
  FETCH_LAP_SUCCESS,
  LOAD_RACE_FILE,
  RESET_RACE_FILE,
} from "./actions";
import { RaceState, RaceReducerAction } from "./types";

const INITIAL_STATE: RaceState = {
  session: undefined,
  participants: [],
  laps: [],
};

export const raceReducer = (
  state: RaceState = INITIAL_STATE,
  action: RaceReducerAction
): RaceState => {
  switch (action.type) {
    case RESET_RACE_FILE: {
      return {
        ...state,
        laps: [],
        session: undefined,
        participants: [],
      };
    }

    case LOAD_RACE_FILE: {
      const { raceFile } = action.payload;
      return {
        ...state,
        laps: raceFile,
      };
    }

    case FETCH_SESSION_SUCCESS: {
      const { session } = action.payload;
      return { ...state, session };
    }

    case FETCH_LAP_SUCCESS: {
      const { lap } = action.payload;
      return { ...state, laps: { ...state.laps, ...lap } };
    }

    default: {
      return state;
    }
  }
};
