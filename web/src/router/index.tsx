import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
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

          const { user } = store.getState().user;
          const { systemStatus } = store.getState().global;

          // if user is authenticated, then show home
          if (!isNullorUndefined(user)) {
            return null;
          }

          // if user is anonymous, then redirect to auth if disabled public memos, else redirect to explore
          if (systemStatus.disablePublicMemos) {
            return redirect("/auth");
          }

          return redirect("/explore");
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

          const { user } = store.getState().user;
          const { systemStatus } = store.getState().global;

          if (isNullorUndefined(user) && systemStatus.disablePublicMemos) {
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

          const { user } = store.getState().user;

          if (isNullorUndefined(user)) {
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

          const { user } = store.getState().user;

          if (isNullorUndefined(user)) {
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

          const { user } = store.getState().user;

          if (isNullorUndefined(user)) {
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

          const { user } = store.getState().user;

          if (isNullorUndefined(user)) {
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

      const { user } = store.getState().user;
      const { systemStatus } = store.getState().global;

      if (isNullorUndefined(user) && systemStatus.disablePublicMemos) {
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
    path: "/u/:username",
    element: <UserProfile />,
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
