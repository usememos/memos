import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import Archived from "@/pages/Archived";
import DailyReview from "@/pages/DailyReview";
import ResourcesDashboard from "@/pages/ResourcesDashboard";
import Setting from "@/pages/Setting";
import { initialGlobalState } from "@/store/module";

const Root = lazy(() => import("@/layouts/Root"));
const Auth = lazy(() => import("@/pages/Auth"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Explore = lazy(() => import("@/pages/Explore"));
const Home = lazy(() => import("@/pages/Home"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const MemoDetail = lazy(() => import("@/pages/MemoDetail"));
const EmbedMemo = lazy(() => import("@/pages/EmbedMemo"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const initialGlobalStateLoader = (() => {
  let done = false;

  return async () => {
    if (done) {
      return;
    }
    done = true;
    try {
      await initialGlobalState();
    } catch (error) {
      // do nth
    }
  };
})();

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/auth",
        element: <Auth />,
        loader: async () => {
          await initialGlobalStateLoader();
          return null;
        },
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
            element: <Home />,
          },
          {
            path: "explore",
            element: <Explore />,
          },
          {
            path: "review",
            element: <DailyReview />,
          },
          {
            path: "resources",
            element: <ResourcesDashboard />,
          },
          {
            path: "archived",
            element: <Archived />,
          },
          {
            path: "setting",
            element: <Setting />,
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
