import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import SuspenseWrapper from "@/layouts/SuspenseWrapper";
import { initialGlobalState } from "@/store/module";
import AuthStatusProvider from "./AuthStatusProvider";

const Root = lazy(() => import("@/layouts/Root"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Explore = lazy(() => import("@/pages/Explore"));
const Home = lazy(() => import("@/pages/Home"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const MemoDetail = lazy(() => import("@/pages/MemoDetail"));
const Archived = lazy(() => import("@/pages/Archived"));
const Timeline = lazy(() => import("@/pages/Timeline"));
const Resources = lazy(() => import("@/pages/Resources"));
const Inboxes = lazy(() => import("@/pages/Inboxes"));
const Setting = lazy(() => import("@/pages/Setting"));
const About = lazy(() => import("@/pages/About"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PermissionDenied = lazy(() => import("@/pages/PermissionDenied"));

const initialGlobalStateLoader = async () => {
  try {
    await initialGlobalState();
  } catch (error) {
    // do nothing.
  }
  return null;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    loader: () => initialGlobalStateLoader(),
    children: [
      {
        path: "/auth/",
        element: <SuspenseWrapper />,
        children: [
          {
            path: "",
            element: <SignIn />,
          },
          {
            path: "signup",
            element: <SignUp />,
          },
          {
            path: "callback",
            element: <AuthCallback />,
          },
        ],
      },
      {
        path: "/",
        element: <Root />,
        children: [
          {
            path: "",
            element: (
              <AuthStatusProvider>
                <Home />
              </AuthStatusProvider>
            ),
          },
          {
            path: "timeline",
            element: (
              <AuthStatusProvider>
                <Timeline />
              </AuthStatusProvider>
            ),
          },
          {
            path: "resources",
            element: (
              <AuthStatusProvider>
                <Resources />
              </AuthStatusProvider>
            ),
          },
          {
            path: "inbox",
            element: (
              <AuthStatusProvider>
                <Inboxes />
              </AuthStatusProvider>
            ),
          },
          {
            path: "archived",
            element: (
              <AuthStatusProvider>
                <Archived />
              </AuthStatusProvider>
            ),
          },
          {
            path: "setting",
            element: (
              <AuthStatusProvider>
                <Setting />
              </AuthStatusProvider>
            ),
          },
          {
            path: "explore",
            element: <Explore />,
          },
          {
            path: "m/:memoId",
            element: <MemoDetail />,
          },
          {
            path: "u/:username",
            element: <UserProfile />,
          },
          {
            path: "about",
            element: <About />,
          },
          {
            path: "403",
            element: <PermissionDenied />,
          },
          {
            path: "404",
            element: <NotFound />,
          },
          {
            path: "*",
            element: <NotFound />,
          },
        ],
      },
    ],
  },
]);

export default router;
