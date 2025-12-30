import type { ComponentType } from "react";
import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import Spinner from "@/components/Spinner";
import MainLayout from "@/layouts/MainLayout";
import RootLayout from "@/layouts/RootLayout";
import Home from "@/pages/Home";

const AdminSignIn = lazy(() => import("@/pages/AdminSignIn"));
const Archived = lazy(() => import("@/pages/Archived"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Explore = lazy(() => import("@/pages/Explore"));
const Inboxes = lazy(() => import("@/pages/Inboxes"));
const MemoDetail = lazy(() => import("@/pages/MemoDetail"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PermissionDenied = lazy(() => import("@/pages/PermissionDenied"));
const Attachments = lazy(() => import("@/pages/Attachments"));
const Setting = lazy(() => import("@/pages/Setting"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const MemoDetailRedirect = lazy(() => import("./MemoDetailRedirect"));

import { ROUTES } from "./routes";

// Backward compatibility alias
export const Routes = ROUTES;
export { ROUTES };

// Helper component to reduce Suspense boilerplate for lazy routes
const LazyRoute = ({ component: Component }: { component: ComponentType }) => (
  <Suspense
    fallback={
      <div className="w-full h-64 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }
  >
    <Component />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          { path: "", element: <LazyRoute component={SignIn} /> },
          { path: "admin", element: <LazyRoute component={AdminSignIn} /> },
          { path: "signup", element: <LazyRoute component={SignUp} /> },
          { path: "callback", element: <LazyRoute component={AuthCallback} /> },
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
              { path: Routes.EXPLORE, element: <LazyRoute component={Explore} /> },
              { path: Routes.ARCHIVED, element: <LazyRoute component={Archived} /> },
              { path: "u/:username", element: <LazyRoute component={UserProfile} /> },
            ],
          },
          { path: Routes.ATTACHMENTS, element: <LazyRoute component={Attachments} /> },
          { path: Routes.INBOX, element: <LazyRoute component={Inboxes} /> },
          { path: Routes.SETTING, element: <LazyRoute component={Setting} /> },
          { path: "memos/:uid", element: <LazyRoute component={MemoDetail} /> },
          // Redirect old path to new path
          { path: "m/:uid", element: <LazyRoute component={MemoDetailRedirect} /> },
          { path: "403", element: <LazyRoute component={PermissionDenied} /> },
          { path: "404", element: <LazyRoute component={NotFound} /> },
          { path: "*", element: <LazyRoute component={NotFound} /> },
        ],
      },
    ],
  },
]);

export default router;
