import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
import App from "@/App";
import Archived from "@/pages/Archived";
import DailyReview from "@/pages/DailyReview";
import Resources from "@/pages/Resources";
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

const initialUserStateLoader = async (redirectWhenNotFound = true) => {
  let user = undefined;
  try {
    user = await initialUserState();
  } catch (error) {
    // do nothing.
  }

  if (!user && redirectWhenNotFound) {
    return redirect("/explore");
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
            loader: () => initialUserStateLoader(),
          },
          {
            path: "explore",
            element: <Explore />,
            loader: () => initialUserStateLoader(false),
          },
          {
            path: "review",
            element: <DailyReview />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "resources",
            element: <Resources />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "archived",
            element: <Archived />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "setting",
            element: <Setting />,
            loader: () => initialUserStateLoader(),
          },
        ],
      },
      {
        path: "/m/:memoId",
        element: <MemoDetail />,
        loader: () => initialUserStateLoader(false),
      },
      {
        path: "/m/:memoId/embed",
        element: <EmbedMemo />,
        loader: () => initialUserStateLoader(false),
      },
      {
        path: "/u/:username",
        element: <UserProfile />,
        loader: () => initialUserStateLoader(false),
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
