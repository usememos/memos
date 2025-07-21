import { Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import HomeLayout from "@/layouts/HomeLayout";
import RootLayout from "@/layouts/RootLayout";
import Home from "@/pages/Home";
import Loading from "@/pages/Loading";

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

export enum Routes {
  ROOT = "/",
  ATTACHMENTS = "/attachments",
  INBOX = "/inbox",
  ARCHIVED = "/archived",
  SETTING = "/setting",
  EXPLORE = "/explore",
  AUTH = "/auth",
}

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
              <Suspense fallback={<Loading />}>
                <SignIn />
              </Suspense>
            ),
          },
          {
            path: "admin",
            element: (
              <Suspense fallback={<Loading />}>
                <AdminSignIn />
              </Suspense>
            ),
          },
          {
            path: "signup",
            element: (
              <Suspense fallback={<Loading />}>
                <SignUp />
              </Suspense>
            ),
          },
          {
            path: "callback",
            element: (
              <Suspense fallback={<Loading />}>
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
            element: <HomeLayout />,
            children: [
              {
                path: "",
                element: <Home />,
              },
              {
                path: Routes.ARCHIVED,
                element: (
                  <Suspense fallback={<Loading />}>
                    <Archived />
                  </Suspense>
                ),
              },
              {
                path: "u/:username",
                element: (
                  <Suspense fallback={<Loading />}>
                    <UserProfile />
                  </Suspense>
                ),
              },
            ],
          },
          {
            path: Routes.EXPLORE,
            element: (
              <Suspense fallback={<Loading />}>
                <Explore />
              </Suspense>
            ),
          },
          {
            path: Routes.ATTACHMENTS,
            element: (
              <Suspense fallback={<Loading />}>
                <Attachments />
              </Suspense>
            ),
          },
          {
            path: Routes.INBOX,
            element: (
              <Suspense fallback={<Loading />}>
                <Inboxes />
              </Suspense>
            ),
          },
          {
            path: Routes.SETTING,
            element: (
              <Suspense fallback={<Loading />}>
                <Setting />
              </Suspense>
            ),
          },
          {
            path: "memos/:uid",
            element: (
              <Suspense fallback={<Loading />}>
                <MemoDetail />
              </Suspense>
            ),
          },
          // Redirect old path to new path.
          {
            path: "m/:uid",
            element: (
              <Suspense fallback={<Loading />}>
                <MemoDetailRedirect />
              </Suspense>
            ),
          },
          {
            path: "403",
            element: (
              <Suspense fallback={<Loading />}>
                <PermissionDenied />
              </Suspense>
            ),
          },
          {
            path: "404",
            element: (
              <Suspense fallback={<Loading />}>
                <NotFound />
              </Suspense>
            ),
          },
          {
            path: "*",
            element: (
              <Suspense fallback={<Loading />}>
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
