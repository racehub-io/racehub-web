import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import { History } from 'history';
import { raceReducer as race } from './race';

export function createRootReducer(history: History) {
  return combineReducers({
    race,
    router: connectRouter(history),
  });
}

export type RootState = ReturnType<ReturnType<typeof createRootReducer>>;
