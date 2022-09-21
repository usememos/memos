import { createBrowserRouter, redirect } from "react-router-dom";
import { isNullorUndefined } from "../helpers/utils";
import { userService } from "../services";
import Auth from "../pages/Auth";
import Explore from "../pages/Explore";
import Home from "../pages/Home";
import MemoDetail from "../pages/MemoDetail";

const router = createBrowserRouter([
  {
    path: "/auth",
    element: <Auth />,
  },
  {
    path: "/",
    element: <Home />,
    loader: async () => {
      try {
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
