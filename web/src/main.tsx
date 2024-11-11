import "@github/relative-time-element";
import { CssVarsProvider } from "@mui/joy";
import "@usememos/mui/dist/index.css";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import "./css/tailwind.css";
import "./helpers/polyfill";
import "./i18n";
import CommonContextProvider from "./layouts/CommonContextProvider";
import "./less/highlight.less";
import router from "./router";
import store from "./store";
import theme from "./theme";

(async () => {
  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(
    <Provider store={store}>
      <CssVarsProvider theme={theme}>
        <CommonContextProvider>
          <RouterProvider router={router} />
        </CommonContextProvider>
        <Toaster position="top-right" toastOptions={{ className: "dark:bg-zinc-700 dark:text-gray-300" }} />
      </CssVarsProvider>
    </Provider>,
  );
})();
