import React from "react";
import { createRoot } from "react-dom/client";
import Provider from "./labs/Provider";
import appContext from "./stores/appContext";
import appStore from "./stores/appStore";
import App from "./App";
import "./helpers/polyfill";
import "./less/global.less";
import "./css/index.css";

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(
  <React.StrictMode>
    <Provider store={appStore} context={appContext}>
      <App />
    </Provider>
  </React.StrictMode>
);
