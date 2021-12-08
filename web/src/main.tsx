import React from "react";
import ReactDOM from "react-dom";
import Provider from "./labs/Provider";
import appContext from "./stores/appContext";
import appStore from "./stores/appStore";
import App from "./App";
import "./helpers/polyfill";
import "./less/global.less";

ReactDOM.render(
  <React.StrictMode>
    <Provider store={appStore} context={appContext}>
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById("root")
);
