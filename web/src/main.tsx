import "@github/relative-time-element";
import { observer } from "mobx-react-lite";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { RouterProvider } from "react-router-dom";
import "./i18n";
import "./index.css";
import router from "./router";
// Configure MobX before importing any stores
import "./store/config";
import { initialUserStore } from "./store/user";
import { initialWorkspaceStore } from "./store/workspace";
import { applyThemeEarly } from "./utils/theme";
import "leaflet/dist/leaflet.css";

// Apply theme early to prevent flash of wrong theme
applyThemeEarly();

const Main = observer(() => (
  <>
    <RouterProvider router={router} />
    <Toaster position="top-right" />
  </>
));

(async () => {
  await initialWorkspaceStore();
  await initialUserStore();

  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(<Main />);
})();
