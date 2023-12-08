import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
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
const EmbedMemo = lazy(() => import("@/pages/EmbedMemo"));
const Archived = lazy(() => import("@/pages/Archived"));
const DailyReview = lazy(() => import("@/pages/DailyReview"));
const Resources = lazy(() => import("@/pages/Resources"));
const Inboxes = lazy(() => import("@/pages/Inboxes"));
const Setting = lazy(() => import("@/pages/Setting"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
        path: "/auth",
        element: <SignIn />,
      },
      {
        path: "/auth/signup",
        element: <SignUp />,
      },
      {
        path: "/auth/callback",
        element: <AuthCallback />,
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
            path: "review",
            element: (
              <AuthStatusProvider>
                <DailyReview />
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
        ],
      },
      {
        path: "/m/:memoId",
        element: <MemoDetail />,
      },
      {
        path: "/m/:memoId/embed",
        element: <EmbedMemo />,
      },
      {
        path: "/u/:username",
        element: <UserProfile />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
