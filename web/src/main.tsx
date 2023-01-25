import { CssVarsProvider } from "@mui/joy";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import App from "./App";
import theme from "./theme";
import "./helpers/polyfill";
import "./i18n";
import "dayjs/locale/zh";
import "dayjs/locale/fr";
import "dayjs/locale/vi";
import "./less/code-highlight.less";
import "./css/global.css";
import "./css/tailwind.css";

dayjs.extend(relativeTime);

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(
  <Provider store={store}>
    <CssVarsProvider theme={theme}>
      <App />
    </CssVarsProvider>
  </Provider>
);
