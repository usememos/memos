import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import HomeLayout from "@/layouts/HomeLayout";
import RootLayout from "@/layouts/RootLayout";
import About from "@/pages/About";
import AdminSignIn from "@/pages/AdminSignIn";
import Archived from "@/pages/Archived";
import AuthCallback from "@/pages/AuthCallback";
import Explore from "@/pages/Explore";
import Home from "@/pages/Home";
import Inboxes from "@/pages/Inboxes";
import MemoDetail from "@/pages/MemoDetail";
import NotFound from "@/pages/NotFound";
import PermissionDenied from "@/pages/PermissionDenied";
import Resources from "@/pages/Resources";
import Setting from "@/pages/Setting";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import UserProfile from "@/pages/UserProfile";
import MemoDetailRedirect from "./MemoDetailRedirect";

export enum Routes {
  ROOT = "/",
  RESOURCES = "/resources",
  INBOX = "/inbox",
  ARCHIVED = "/archived",
  SETTING = "/setting",
  EXPLORE = "/explore",
  ABOUT = "/about",
  AUTH = "/auth",
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          {
            path: "",
            element: <SignIn />,
          },
          {
            path: "admin",
            element: <AdminSignIn />,
          },
          {
            path: "signup",
            element: <SignUp />,
          },
          {
            path: "callback",
            element: <AuthCallback />,
          },
        ],
      },
      {
        path: Routes.ROOT,
        element: <RootLayout />,
        children: [
          {
            element: <HomeLayout />,
            children: [
              {
                path: "",
                element: <Home />,
              },
              {
                path: Routes.EXPLORE,
                element: <Explore />,
              },
              {
                path: Routes.ARCHIVED,
                element: <Archived />,
              },
              {
                path: "u/:username",
                element: <UserProfile />,
              },
            ],
          },
          {
            path: Routes.RESOURCES,
            element: <Resources />,
          },
          {
            path: Routes.INBOX,
            element: <Inboxes />,
          },
          {
            path: Routes.SETTING,
            element: <Setting />,
          },
          {
            path: "memos/:uid",
            element: <MemoDetail />,
          },
          {
            path: Routes.ABOUT,
            element: <About />,
          },
          // Redirect old path to new path.
          {
            path: "m/:uid",
            element: <MemoDetailRedirect />,
          },
          {
            path: "403",
            element: <PermissionDenied />,
          },
          {
            path: "404",
            element: <NotFound />,
          },
          {
            path: "*",
            element: <NotFound />,
          },
        ],
      },
    ],
  },
]);

export default router;
