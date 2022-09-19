import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import I18nProvider from "./labs/i18n/I18nProvider";
import store from "./store";
import App from "./App";
import "./helpers/polyfill";
import "./less/global.less";
import "./css/index.css";

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(
  <I18nProvider>
    <Provider store={store}>
      <App />
    </Provider>
  </I18nProvider>
);
