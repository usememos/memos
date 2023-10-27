import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
import App from "@/App";
import { initialGlobalState, initialUserState } from "@/store/module";

const Root = lazy(() => import("@/layouts/Root"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Explore = lazy(() => import("@/pages/Explore"));
const Home = lazy(() => import("@/pages/Home"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const MemoDetail = lazy(() => import("@/pages/MemoDetail"));
const EmbedMemo = lazy(() => import("@/pages/EmbedMemo"));
const Archived = lazy(() => import("@/pages/Archived"));
const DailyReview = lazy(() => import("@/pages/DailyReview"));
const Resources = lazy(() => import("@/pages/Resources"));
const Inboxes = lazy(() => import("@/pages/Inboxes"));
const Setting = lazy(() => import("@/pages/Setting"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const initialGlobalStateLoader = async () => {
  try {
    await initialGlobalState();
  } catch (error) {
    // do nth
  }
  return null;
};

const initialUserStateLoader = async (redirectWhenNotFound = true) => {
  let user = undefined;
  try {
    user = await initialUserState();
  } catch (error) {
    // do nothing.
  }

  if (!user && redirectWhenNotFound) {
    return redirect("/explore");
  }
  return null;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    loader: () => initialGlobalStateLoader(),
    children: [
      {
        path: "/auth",
        element: <SignIn />,
      },
      {
        path: "/auth/signup",
        element: <SignUp />,
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
            loader: () => initialUserStateLoader(),
          },
          {
            path: "explore",
            element: <Explore />,
            loader: () => initialUserStateLoader(false),
          },
          {
            path: "review",
            element: <DailyReview />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "resources",
            element: <Resources />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "inbox",
            element: <Inboxes />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "archived",
            element: <Archived />,
            loader: () => initialUserStateLoader(),
          },
          {
            path: "setting",
            element: <Setting />,
            loader: () => initialUserStateLoader(),
          },
        ],
      },
      {
        path: "/m/:memoId",
        element: <MemoDetail />,
        loader: () => initialUserStateLoader(false),
      },
      {
        path: "/m/:memoId/embed",
        element: <EmbedMemo />,
        loader: () => initialUserStateLoader(false),
      },
      {
        path: "/u/:username",
        element: <UserProfile />,
        loader: () => initialUserStateLoader(false),
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
