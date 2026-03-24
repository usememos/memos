import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import { ChunkLoadErrorFallback } from "@/components/ErrorBoundary";
import MainLayout from "@/layouts/MainLayout";
import RootLayout from "@/layouts/RootLayout";
import Home from "@/pages/Home";

// Wrap lazy imports to auto-reload on chunk load failure (e.g., after redeployment).
function lazyWithReload<T extends React.ComponentType>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((error) => {
      const isChunkError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Importing a module script failed");
      const reloadKey = "chunk-reload";
      if (isChunkError && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
      throw error;
    }),
  );
}

const AdminSignIn = lazyWithReload(() => import("@/pages/AdminSignIn"));
const Archived = lazyWithReload(() => import("@/pages/Archived"));
const AuthCallback = lazyWithReload(() => import("@/pages/AuthCallback"));
const Explore = lazyWithReload(() => import("@/pages/Explore"));
const Inboxes = lazyWithReload(() => import("@/pages/Inboxes"));
const MemoDetail = lazyWithReload(() => import("@/pages/MemoDetail"));
const NotFound = lazyWithReload(() => import("@/pages/NotFound"));
const PermissionDenied = lazyWithReload(() => import("@/pages/PermissionDenied"));
const Attachments = lazyWithReload(() => import("@/pages/Attachments"));
const Setting = lazyWithReload(() => import("@/pages/Setting"));
const SignIn = lazyWithReload(() => import("@/pages/SignIn"));
const SignUp = lazyWithReload(() => import("@/pages/SignUp"));
const UserProfile = lazyWithReload(() => import("@/pages/UserProfile"));

import { ROUTES } from "./routes";

// Backward compatibility alias
export const Routes = ROUTES;
export { ROUTES };

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ChunkLoadErrorFallback />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          { path: "", element: <SignIn /> },
          { path: "admin", element: <AdminSignIn /> },
          { path: "signup", element: <SignUp /> },
          { path: "callback", element: <AuthCallback /> },
        ],
      },
      {
        path: Routes.ROOT,
        element: <RootLayout />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: "", element: <Home /> },
              { path: Routes.EXPLORE, element: <Explore /> },
              { path: Routes.ARCHIVED, element: <Archived /> },
              { path: "u/:username", element: <UserProfile /> },
            ],
          },
          { path: Routes.ATTACHMENTS, element: <Attachments /> },
          { path: Routes.INBOX, element: <Inboxes /> },
          { path: Routes.SETTING, element: <Setting /> },
          { path: "memos/:uid", element: <MemoDetail /> },
          { path: "memos/shares/:token", element: <MemoDetail /> },
          { path: "403", element: <PermissionDenied /> },
          { path: "404", element: <NotFound /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default router;
