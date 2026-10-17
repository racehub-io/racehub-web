import { combineReducers } from 'redux';
import { raceReducer as race } from './race';

export function createRootReducer() {
  return combineReducers({
    race,
  });
}

export type RootState = ReturnType<ReturnType<typeof createRootReducer>>;
