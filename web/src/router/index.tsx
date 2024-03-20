import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import HomeLayout from "@/layouts/HomeLayout";
import SuspenseWrapper from "@/layouts/SuspenseWrapper";

const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Explore = lazy(() => import("@/pages/Explore"));
const Home = lazy(() => import("@/pages/Home"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const MemoDetail = lazy(() => import("@/pages/MemoDetail"));
const Archived = lazy(() => import("@/pages/Archived"));
const Timeline = lazy(() => import("@/pages/Timeline"));
const Resources = lazy(() => import("@/pages/Resources"));
const Inboxes = lazy(() => import("@/pages/Inboxes"));
const Setting = lazy(() => import("@/pages/Setting"));
const About = lazy(() => import("@/pages/About"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PermissionDenied = lazy(() => import("@/pages/PermissionDenied"));

export enum Routes {
  HOME = "/",
  TIMELINE = "/timeline",
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
        element: <SuspenseWrapper />,
        children: [
          {
            path: "",
            element: <SignIn />,
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
        path: "/",
        element: <HomeLayout />,
        children: [
          {
            path: Routes.HOME,
            element: <Home />,
          },
          {
            path: Routes.TIMELINE,
            element: <Timeline />,
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
