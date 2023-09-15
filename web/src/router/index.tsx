import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
import App from "@/App";
import Archived from "@/pages/Archived";
import DailyReview from "@/pages/DailyReview";
import ResourcesDashboard from "@/pages/ResourcesDashboard";
import Setting from "@/pages/Setting";
import { initialGlobalState, initialUserState } from "@/store/module";

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

const userStateLoader = async () => {
  try {
    const user = await initialUserState();
    if (!user) {
      return redirect("/explore");
    }
  } catch (error) {
    // do nothing.
  }
  return null;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    loader: async () => {
      await initialGlobalStateLoader();
      return null;
    },
    children: [
      {
        path: "/auth",
        element: <Auth />,
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
            loader: userStateLoader,
          },
          {
            path: "explore",
            element: <Explore />,
            loader: async () => {
              try {
                await initialUserState();
              } catch (error) {
                // do nothing.
              }
              return null;
            },
          },
          {
            path: "review",
            element: <DailyReview />,
            loader: userStateLoader,
          },
          {
            path: "resources",
            element: <ResourcesDashboard />,
            loader: userStateLoader,
          },
          {
            path: "archived",
            element: <Archived />,
            loader: userStateLoader,
          },
          {
            path: "setting",
            element: <Setting />,
            loader: userStateLoader,
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
