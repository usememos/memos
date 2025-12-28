import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import Skeleton from "@/components/Skeleton";
import MainLayout from "@/layouts/MainLayout";
import RootLayout from "@/layouts/RootLayout";
import Home from "@/pages/Home";

const AdminSignIn = lazy(() => import("@/pages/AdminSignIn"));
const Archived = lazy(() => import("@/pages/Archived"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Calendar = lazy(() => import("@/pages/Calendar"));
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          {
            path: "",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <SignIn />
              </Suspense>
            ),
          },
          {
            path: "admin",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <AdminSignIn />
              </Suspense>
            ),
          },
          {
            path: "signup",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <SignUp />
              </Suspense>
            ),
          },
          {
            path: "callback",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <AuthCallback />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: Routes.ROOT,
        element: <RootLayout />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                path: "",
                element: <Home />,
              },
              {
                path: Routes.EXPLORE,
                element: (
                  <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                    <Explore />
                  </Suspense>
                ),
              },
              {
                path: Routes.ARCHIVED,
                element: (
                  <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                    <Archived />
                  </Suspense>
                ),
              },
              {
                path: "u/:username",
                element: (
                  <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                    <UserProfile />
                  </Suspense>
                ),
              },
            ],
          },
          {
            path: Routes.ATTACHMENTS,
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <Attachments />
              </Suspense>
            ),
          },
          {
            path: Routes.CALENDAR,
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <Calendar />
              </Suspense>
            ),
          },
          {
            path: Routes.INBOX,
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <Inboxes />
              </Suspense>
            ),
          },
          {
            path: Routes.SETTING,
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <Setting />
              </Suspense>
            ),
          },
          {
            path: "memos/:uid",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <MemoDetail />
              </Suspense>
            ),
          },
          // Redirect old path to new path.
          {
            path: "m/:uid",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <MemoDetailRedirect />
              </Suspense>
            ),
          },
          {
            path: "403",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <PermissionDenied />
              </Suspense>
            ),
          },
          {
            path: "404",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <NotFound />
              </Suspense>
            ),
          },
          {
            path: "*",
            element: (
              <Suspense fallback={<Skeleton type="route" showEditor={false} />}>
                <NotFound />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
]);

export default router;
