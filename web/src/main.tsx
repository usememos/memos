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
import { initialInstanceStore } from "./store/instance";
import userStore, { initialUserStore } from "./store/user";
import { applyThemeEarly } from "./utils/theme";
import "leaflet/dist/leaflet.css";

// Apply theme early to prevent flash of wrong theme
// This uses localStorage as the source before user settings are loaded
applyThemeEarly();

const Main = observer(() => (
  <>
    <RouterProvider router={router} />
    <Toaster position="top-right" />
  </>
));

(async () => {
  // Initialize stores
  await initialInstanceStore();
  await initialUserStore();

  // Apply user preferences (theme & locale) after user settings are loaded
  // This will override the early theme with user's actual preference
  userStore.applyUserPreferences();

  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(<Main />);
})();
