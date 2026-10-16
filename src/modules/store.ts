import { Action } from "@reduxjs/toolkit";
import createSagasMiddleware from "redux-saga";
import { applyMiddleware, compose, createStore } from "redux";

import { createHashHistory } from "history";
import { ThunkAction } from "redux-thunk";

import { createRootReducer } from "./reducer";
import { rootSaga } from "./sagas";

const isDev = process.env.NODE_ENV === "development";
const anyWindow = window as any;

const composeEnhancers =
  isDev && anyWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? anyWindow.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : compose;

export const history = createHashHistory();
const rootReducer = createRootReducer(history);

const sagasMiddleware = createSagasMiddleware();

const middleware = applyMiddleware(sagasMiddleware);

const enhancer = composeEnhancers(middleware);

export type RootState = ReturnType<typeof rootReducer>;

export const configuredStore = () => {
  // Create Store
  const store = createStore(rootReducer, enhancer);
  sagasMiddleware.run(rootSaga);

  if (process.env.NODE_ENV === "development" && (module as any).hot) {
    (module as any).hot.accept(
      "./reducer",
      // eslint-disable-next-line global-require
      () => store.replaceReducer(require("./reducer").default)
    );
  }
  return store;
};
export type Store = ReturnType<typeof configuredStore>;
export type AppThunk = ThunkAction<void, RootState, unknown, Action<string>>;
