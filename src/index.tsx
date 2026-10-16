import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import reportWebVitals from "./reportWebVitals";
import { configuredStore } from "./modules/store";
import { UIProvider } from "./modules/context";
import Root from "./Root";
import "./index.scss";

const store = configuredStore();

ReactDOM.render(
  <Provider store={store}>
    <UIProvider>
      <Root />
    </UIProvider>
  </Provider>,
  document.getElementById("root")
);

reportWebVitals();
