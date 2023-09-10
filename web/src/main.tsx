import { CssVarsProvider } from "@mui/joy";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import "./css/global.css";
import "./css/tailwind.css";
import "./helpers/polyfill";
import "./i18n";
import "./less/code-highlight.less";
import router from "./router";
import store from "./store";
import theme from "./theme";

const container = document.getElementById("root");
const root = createRoot(container as HTMLElement);
root.render(
  <Provider store={store}>
    <CssVarsProvider theme={theme}>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </CssVarsProvider>
  </Provider>
);
