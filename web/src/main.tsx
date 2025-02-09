import "@github/relative-time-element";
import { CssVarsProvider } from "@mui/joy";
import "@usememos/mui/dist/index.css";
import "leaflet/dist/leaflet.css";
import { observer } from "mobx-react-lite";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { RouterProvider } from "react-router-dom";
import "./css/tailwind.css";
import "./i18n";
import "./less/highlight.less";
import router from "./router";
import { initialUserStore } from "./store/v2/user";
import { initialWorkspaceStore } from "./store/v2/workspace";
import theme from "./theme";

const Main = observer(() => (
  <CssVarsProvider theme={theme}>
    <RouterProvider router={router} />
    <Toaster position="top-right" toastOptions={{ className: "dark:bg-zinc-700 dark:text-gray-300" }} />
  </CssVarsProvider>
));

(async () => {
  await initialWorkspaceStore();
  await initialUserStore();

  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(<Main />);
})();
