import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "@/App";
import RootLayout from "@/layouts/RootLayout";
import SuspenseWrapper from "@/layouts/SuspenseWrapper";
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
import RawDataView from "@/pages/RawDataView";
import Book from "@/pages/RawDataView/Book";
import Pet from "@/pages/RawDataView/Pet";
import Video from "@/pages/RawDataView/Video";
import Resources from "@/pages/Resources";
import Setting from "@/pages/Setting";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import UserProfile from "@/pages/UserProfile";

export enum Routes {
  ROOT = "/",
  RESOURCES = "/resources",
  INBOX = "/inbox",
  ARCHIVED = "/archived",
  SETTING = "/setting",
  EXPLORE = "/explore",
  ABOUT = "/about",
  AUTH = "/auth",
  RAW_DATA_VIEW = "/raw-data-view",
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: Routes.AUTH,
        element: <SuspenseWrapper />,
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
            path: "",
            element: <Home />,
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
            path: Routes.ARCHIVED,
            element: <Archived />,
          },
          {
            path: Routes.SETTING,
            element: <Setting />,
          },
          {
            path: Routes.EXPLORE,
            element: <Explore />,
          },
          {
            path: Routes.RAW_DATA_VIEW,
            element: <RawDataView />,
            children: [
              {
                index: true,
                element: <Navigate to="pet" replace />,
              },
              {
                path: "pet",
                element: <Pet />,
              },
              {
                path: "book",
                element: <Book />,
              },
              {
                path: "video",
                element: <Video />,
              },
            ],
          },
          {
            path: "m/:uid",
            element: <MemoDetail />,
          },
          {
            path: "u/:username",
            element: <UserProfile />,
          },
          {
            path: Routes.ABOUT,
            element: <About />,
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
