import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import { updateStateWithLocation } from "./store/modules/location";
import App from "./App";
import "./less/global.less";
import "./helpers/polyfill";
import "./css/index.css";

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);

window.onload = () => {
  store.dispatch(updateStateWithLocation());
  window.onpopstate = () => {
    store.dispatch(updateStateWithLocation());
  };
};
