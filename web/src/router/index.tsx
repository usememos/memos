import { createBrowserRouter, redirect } from "react-router-dom";
import { lazy } from "react";
import { isNullorUndefined } from "../helpers/utils";
import store from "../store";
import { initialGlobalState, initialUserState } from "../store/module";

const Auth = lazy(() => import("../pages/Auth"));
const Explore = lazy(() => import("../pages/Explore"));
const Home = lazy(() => import("../pages/Home"));
const MemoDetail = lazy(() => import("../pages/MemoDetail"));
const EmbedMemo = lazy(() => import("../pages/EmbedMemo"));
const NotFound = lazy(() => import("../pages/NotFound"));

const router = createBrowserRouter([
  {
    path: "/auth",
    element: <Auth />,
    loader: async () => {
      try {
        await initialGlobalState();
      } catch (error) {
        // do nth
      }
      return null;
    },
  },
  {
    path: "/",
    element: <Home />,
    loader: async () => {
      try {
        await initialGlobalState();
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
      try {
        await initialGlobalState();
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
    path: "/explore",
    element: <Explore />,
    loader: async () => {
      try {
        await initialGlobalState();
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
    path: "/m/:memoId",
    element: <MemoDetail />,
    loader: async () => {
      try {
        await initialGlobalState();
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
      try {
        await initialGlobalState();
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
      try {
        await initialGlobalState();
      } catch (error) {
        // do nth
      }
      return null;
    },
  },
]);

export default router;
