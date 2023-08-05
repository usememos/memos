import { CssVarsProvider } from "@mui/joy";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "./css/global.css";
import "./css/tailwind.css";
import "./helpers/polyfill";
import "./i18n";
import "./less/code-highlight.less";
import store from "./store";
import theme from "./theme";

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(
  <Provider store={store}>
    <CssVarsProvider theme={theme}>
      <App />
    </CssVarsProvider>
  </Provider>
);
