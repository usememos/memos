import { createBrowserRouter, redirect } from "react-router-dom";
import { lazy } from "react";
import { isNullorUndefined } from "@/helpers/utils";
import store from "@/store";
import { initialGlobalState, initialUserState } from "@/store/module";
import DailyReview from "@/pages/DailyReview";
import ResourcesDashboard from "@/pages/ResourcesDashboard";
import Setting from "@/pages/Setting";
import Archived from "@/pages/Archived";

const Root = lazy(() => import("@/layouts/Root"));
const Auth = lazy(() => import("@/pages/Auth"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Explore = lazy(() => import("@/pages/Explore"));
const Home = lazy(() => import("@/pages/Home"));
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
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host, user } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          } else if (isNullorUndefined(user)) {
            return redirect("/explore");
          }
          return null;
        },
      },
      {
        path: "/u/:userId",
        element: <Home />,
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          }
          return null;
        },
      },
      {
        path: "explore",
        element: <Explore />,
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          }
          return null;
        },
      },
      {
        path: "review",
        element: <DailyReview />,
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          }
          return null;
        },
      },
      {
        path: "resources",
        element: <ResourcesDashboard />,
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          }
          return null;
        },
      },
      {
        path: "archived",
        element: <Archived />,
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          }
          return null;
        },
      },
      {
        path: "setting",
        element: <Setting />,
        loader: async () => {
          await initialGlobalStateLoader();

          try {
            await initialUserState();
          } catch (error) {
            // do nth
          }

          const { host } = store.getState().user;
          if (isNullorUndefined(host)) {
            return redirect("/auth");
          }
          return null;
        },
      },
    ],
  },
  {
    path: "/m/:memoId",
    element: <MemoDetail />,
    loader: async () => {
      await initialGlobalStateLoader();

      try {
        await initialUserState();
      } catch (error) {
        // do nth
      }

      const { host } = store.getState().user;
      if (isNullorUndefined(host)) {
        return redirect("/auth");
      }
      return null;
    },
  },
  {
    path: "/m/:memoId/embed",
    element: <EmbedMemo />,
    loader: async () => {
      await initialGlobalStateLoader();

      try {
        await initialUserState();
      } catch (error) {
        // do nth
      }
      return null;
    },
  },
  {
    path: "*",
    element: <NotFound />,
    loader: async () => {
      await initialGlobalStateLoader();
      return null;
    },
  },
]);

export default router;
