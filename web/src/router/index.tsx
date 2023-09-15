import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
import App from "@/App";
import { isNullorUndefined } from "@/helpers/utils";
import Archived from "@/pages/Archived";
import DailyReview from "@/pages/DailyReview";
import ResourcesDashboard from "@/pages/ResourcesDashboard";
import Setting from "@/pages/Setting";
import store from "@/store";
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
        loader: async () => {
          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }
          return null;
        },
        children: [
          {
            path: "",
            element: <Home />,
            loader: async () => {
              const { user } = store.getState().user;

              if (isNullorUndefined(user)) {
                return redirect("/explore");
              }
            },
          },
          {
            path: "explore",
            element: <Explore />,
          },
          {
            path: "review",
            element: <DailyReview />,
            loader: async () => {
              const { user } = store.getState().user;

              if (isNullorUndefined(user)) {
                return redirect("/explore");
              }
            },
          },
          {
            path: "resources",
            element: <ResourcesDashboard />,
            loader: async () => {
              const { user } = store.getState().user;

              if (isNullorUndefined(user)) {
                return redirect("/explore");
              }
            },
          },
          {
            path: "archived",
            element: <Archived />,
            loader: async () => {
              const { user } = store.getState().user;

              if (isNullorUndefined(user)) {
                return redirect("/explore");
              }
            },
          },
          {
            path: "setting",
            element: <Setting />,
            loader: async () => {
              const { user } = store.getState().user;

              if (isNullorUndefined(user)) {
                return redirect("/explore");
              }
            },
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
