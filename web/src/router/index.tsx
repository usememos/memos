import { lazy } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import App from "@/App";
import { ChunkLoadErrorFallback } from "@/components/ErrorBoundary";
import MainLayout from "@/layouts/MainLayout";
import RootLayout from "@/layouts/RootLayout";
import Home from "@/pages/Home";
import { LandingRoute, RequireAuthRoute, RequireGuestRoute } from "./guards";
import { ROUTES } from "./routes";

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

// Backward compatibility alias.
export const Routes = ROUTES;
export { ROUTES };

/**
 * Static route configuration. Exported so tests can assert on the tree shape
 * (e.g. that `/auth/callback` stays outside the guest-only guard subtree) and
 * so integration tests can drive a `createMemoryRouter` over the same tree.
 */
export const routeConfig: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    errorElement: <ChunkLoadErrorFallback />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          // The OAuth callback must run regardless of the current session — an
          // authenticated tab elsewhere must not block it from consuming its
          // one-time OAuth state. Keep it outside the guest-only subtree.
          { path: "callback", element: <AuthCallback /> },
          {
            element: <RequireGuestRoute />,
            children: [
              { path: "", element: <SignIn /> },
              { path: "admin", element: <AdminSignIn /> },
              { path: "signup", element: <SignUp /> },
            ],
          },
        ],
      },
      { index: true, element: <LandingRoute /> },
      {
        path: Routes.ENTRY,
        element: <RootLayout />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: Routes.EXPLORE, element: <Explore /> },
              { path: "u/:username", element: <UserProfile /> },
              {
                element: <RequireAuthRoute />,
                children: [
                  { path: Routes.HOME, element: <Home /> },
                  { path: Routes.ARCHIVED, element: <Archived /> },
                ],
              },
            ],
          },
          { path: "memos/:uid", element: <MemoDetail /> },
          { path: "memos/shares/:token", element: <MemoDetail /> },
          {
            element: <RequireAuthRoute />,
            children: [
              { path: Routes.ATTACHMENTS, element: <Attachments /> },
              { path: Routes.INBOX, element: <Inboxes /> },
              { path: Routes.SETTING, element: <Setting /> },
            ],
          },
          { path: "403", element: <PermissionDenied /> },
          { path: "404", element: <NotFound /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routeConfig);

export default router;
