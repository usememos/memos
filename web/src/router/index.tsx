import { createBrowserRouter, redirect } from "react-router-dom";
import { isNullorUndefined } from "../helpers/utils";
import { globalService, userService } from "../services";
import Auth from "../pages/Auth";
import Explore from "../pages/Explore";
import Home from "../pages/Home";
import MemoDetail from "../pages/MemoDetail";

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
      return null;
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
      return null;
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
      return null;
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
      return null;
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
      return null;
    },
  },
]);

export default router;
