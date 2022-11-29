import { createBrowserRouter, redirect } from "react-router-dom";
import { lazy } from "react";
import { isNullorUndefined } from "../helpers/utils";
import { globalService, userService } from "../services";

const Auth = lazy(() => import("../pages/Auth"));
const Explore = lazy(() => import("../pages/Explore"));
const Home = lazy(() => import("../pages/Home"));
const MemoDetail = lazy(() => import("../pages/MemoDetail"));

const router = createBrowserRouter([
  {
    path: "/auth",
    element: <Auth />,
    loader: async () => {
      try {
        await globalService.initialState();
      } catch (error) {
        // do nth
      }
    },
  },
  {
    path: "/",
    element: <Home />,
    loader: async () => {
      try {
        await globalService.initialState();
        await userService.initialState();
      } catch (error) {
        // do nth
      }

      const { host, user } = userService.getState();
      if (isNullorUndefined(host)) {
        return redirect("/auth");
      } else if (isNullorUndefined(user)) {
        return redirect("/explore");
      }
    },
  },
  {
    path: "/u/:userId",
    element: <Home />,
    loader: async () => {
      try {
        await globalService.initialState();
        await userService.initialState();
      } catch (error) {
        // do nth
      }

      const { host } = userService.getState();
      if (isNullorUndefined(host)) {
        return redirect("/auth");
      }
    },
  },
  {
    path: "/explore",
    element: <Explore />,
    loader: async () => {
      try {
        await globalService.initialState();
        await userService.initialState();
      } catch (error) {
        // do nth
      }

      const { host } = userService.getState();
      if (isNullorUndefined(host)) {
        return redirect("/auth");
      }
    },
  },
  {
    path: "/m/:memoId",
    element: <MemoDetail />,
    loader: async () => {
      try {
        await globalService.initialState();
        await userService.initialState();
      } catch (error) {
        // do nth
      }

      const { host } = userService.getState();
      if (isNullorUndefined(host)) {
        return redirect("/auth");
      }
    },
  },
]);

export default router;
