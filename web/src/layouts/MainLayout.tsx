import { useEffect, useMemo, useState } from "react";
import { matchPath, Outlet, useLocation } from "react-router-dom";
import type { MemoExplorerContext } from "@/components/MemoExplorer";
import { MemoExplorer, MemoExplorerDrawer } from "@/components/MemoExplorer";
import MobileHeader from "@/components/MobileHeader";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";

const ARCHIVED_ROUTE = "/archived";
const PROFILE_ROUTE = "/u/:username";
const DESKTOP_EXPLORER_WIDTH_CLASS = "w-64";
const DESKTOP_EXPLORER_CLASS_NAME = cn(
  "fixed top-0 left-16 h-svh shrink-0 border-r border-border transition-all",
  DESKTOP_EXPLORER_WIDTH_CLASS,
);
const MAIN_CONTENT_CLASS_NAME = cn("w-full min-h-full", "md:pl-64");

const MainLayout = () => {
  const md = useMediaQuery("md");
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [profileUserName, setProfileUserName] = useState<string | undefined>();

  // Determine context based on current route
  const context: MemoExplorerContext = useMemo(() => {
    if (location.pathname === Routes.ROOT) return "home";
    if (location.pathname === Routes.EXPLORE) return "explore";
    if (matchPath(ARCHIVED_ROUTE, location.pathname)) return "archived";
    if (matchPath(PROFILE_ROUTE, location.pathname)) return "profile";
    return "home"; // fallback
  }, [location.pathname]);

  // Extract username from URL for profile context
  useEffect(() => {
    const match = matchPath(PROFILE_ROUTE, location.pathname);
    if (match && context === "profile") {
      const username = match.params.username;
      if (username) {
        // Fetch or get user to obtain the canonical user name (e.g., "users/steven")
        // Note: User stats will be fetched by useFilteredMemoStats
        userServiceClient
          .getUser({ name: `users/${username}` })
          .then((user) => {
            setProfileUserName(user.name);
          })
          .catch((error) => {
            console.error("Failed to fetch profile user:", error);
            setProfileUserName(undefined);
          });
      }
    } else {
      setProfileUserName(undefined);
    }
  }, [location.pathname, context]);

  // Determine which user name to use for per-user stats.
  // - home: current user's stats
  // - profile: viewed user's stats
  // - archived/explore: no user scope (each handled differently inside the hook)
  const statsUserName = useMemo(() => {
    if (context === "home") return currentUser?.name;
    if (context === "profile") return profileUserName;
    return undefined;
  }, [context, currentUser, profileUserName]);

  const { statistics, tags } = useFilteredMemoStats({ userName: statsUserName, context });
  const memoExplorerProps = { context, statisticsData: statistics, tagCount: tags };

  return (
    <section className="@container w-full min-h-full flex flex-col justify-start items-center">
      {!md && (
        <MobileHeader>
          <MemoExplorerDrawer {...memoExplorerProps} />
        </MobileHeader>
      )}
      {md && (
        <div className={DESKTOP_EXPLORER_CLASS_NAME}>
          <MemoExplorer className="px-3 py-6" {...memoExplorerProps} />
        </div>
      )}
      <div className={MAIN_CONTENT_CLASS_NAME}>
        <div className={cn("w-full mx-auto px-4 sm:px-6 md:pt-6 pb-8")}>
          <Outlet />
        </div>
      </div>
    </section>
  );
};

export default MainLayout;
