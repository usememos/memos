import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
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

import { ROUTES } from "./routes";

// Backward compatibility alias
export const Routes = ROUTES;
export { ROUTES };

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
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
          { path: "403", element: <PermissionDenied /> },
          { path: "404", element: <NotFound /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default router;
