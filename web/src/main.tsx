import "@github/relative-time-element";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { observer } from "mobx-react-lite";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { RouterProvider } from "react-router-dom";
import "./i18n";
import "./index.css";
import { MemoFilterProvider } from "@/contexts/MemoFilterContext";
import { ViewProvider } from "@/contexts/ViewContext";
import { queryClient } from "@/lib/query-client";
import router from "./router";
// Configure MobX before importing any stores
import "./store/config";
import { initialInstanceStore } from "./store/instance";
import { initialUserStore } from "./store/user";
import { applyLocaleEarly } from "./utils/i18n";
import { applyThemeEarly } from "./utils/theme";
import "leaflet/dist/leaflet.css";

// Apply theme and locale early to prevent flash of wrong theme/language
// This uses localStorage as the source before user settings are loaded
applyThemeEarly();
applyLocaleEarly();

const Main = observer(() => (
  <QueryClientProvider client={queryClient}>
    <ViewProvider>
      <MemoFilterProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </MemoFilterProvider>
    </ViewProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
));

(async () => {
  // Initialize stores
  await initialInstanceStore();
  await initialUserStore();

  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(<Main />);
})();
