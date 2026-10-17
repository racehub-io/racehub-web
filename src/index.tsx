import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configuredStore } from "./modules/store";
import { UIProvider } from "./modules/context";
import Root from "./Root";
import "./index.scss";
import "react-grid-layout/css/styles.css";

const store = configuredStore();

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <UIProvider>
      <Root />
    </UIProvider>
  </Provider>
);
