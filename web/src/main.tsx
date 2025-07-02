import "@github/relative-time-element";
import { observer } from "mobx-react-lite";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { RouterProvider } from "react-router-dom";
import "./i18n";
import router from "./router";
import { initialUserStore } from "./store/v2/user";
import { initialWorkspaceStore } from "./store/v2/workspace";
import "./style.css";
import "leaflet/dist/leaflet.css";

const Main = observer(() => (
  <>
    <RouterProvider router={router} />
    <Toaster position="top-right" toastOptions={{ className: "dark:bg-zinc-700 dark:text-gray-300" }} />
  </>
));

(async () => {
  await initialWorkspaceStore();
  await initialUserStore();

  const container = document.getElementById("root");
  const root = createRoot(container as HTMLElement);
  root.render(<Main />);
})();
