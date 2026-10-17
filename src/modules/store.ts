import { createStore } from "redux";
import { createRootReducer } from "./reducer";
const rootReducer = createRootReducer();
export type RootState = ReturnType<typeof rootReducer>;
export const configuredStore = () => createStore(rootReducer);
export type Store = ReturnType<typeof configuredStore>;
