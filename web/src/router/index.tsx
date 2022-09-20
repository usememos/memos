import { createBrowserRouter } from "react-router-dom";
import { userService } from "../services";
import Auth from "../pages/Auth";
import Explore from "../pages/Explore";
import Home from "../pages/Home";
import MemoDetail from "../pages/MemoDetail";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    loader: async () => {
      try {
        await userService.initialState();
      } catch (error) {
        // do nth
      }
    },
  },
  {
    path: "/auth",
    element: <Auth />,
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
    },
  },
]);

export default router;
