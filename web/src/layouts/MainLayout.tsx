import { last } from "lodash-es";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import { matchPath, Outlet, useLocation } from "react-router-dom";
import { MemoExplorer, MemoExplorerContext, MemoExplorerDrawer } from "@/components/MemoExplorer";
import MobileHeader from "@/components/MobileHeader";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { userStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import { State } from "@/types/proto/api/v1/common";
import { Visibility } from "@/types/proto/api/v1/memo_service";

const MainLayout = observer(() => {
  const { md, lg } = useResponsiveWidth();
  const location = useLocation();
  const currentUser = useCurrentUser();

  // Determine context based on current route
  const context: MemoExplorerContext = useMemo(() => {
    if (location.pathname === Routes.ROOT) return "home";
    if (location.pathname === Routes.EXPLORE) return "explore";
    if (matchPath("/archived", location.pathname)) return "archived";
    if (matchPath("/u/:username", location.pathname)) return "profile";
    return "home"; // fallback
  }, [location.pathname]);

  // Compute filter and state based on context
  // This should match what each page uses for their memo list
  const { filter, state } = useMemo(() => {
    if (location.pathname === Routes.ROOT && currentUser) {
      // Home: current user's normal memos
      return {
        filter: `creator_id == ${extractUserIdFromName(currentUser.name)}`,
        state: State.NORMAL,
      };
    } else if (location.pathname === Routes.EXPLORE) {
      // Explore: visible memos (PUBLIC for visitors, PUBLIC+PROTECTED for logged-in)
      const visibilities = currentUser ? [Visibility.PUBLIC, Visibility.PROTECTED] : [Visibility.PUBLIC];
      const visibilityValues = visibilities.map((v) => `"${v}"`).join(", ");
      return {
        filter: `visibility in [${visibilityValues}]`,
        state: State.NORMAL,
      };
    } else if (matchPath("/archived", location.pathname) && currentUser) {
      // Archived: current user's archived memos
      return {
        filter: `creator_id == ${extractUserIdFromName(currentUser.name)}`,
        state: State.ARCHIVED,
      };
    } else if (matchPath("/u/:username", location.pathname)) {
      // Profile: specific user's normal memos
      const username = last(location.pathname.split("/"));
      const user = userStore.getUserByName(`users/${username}`);
      return {
        filter: user ? `creator_id == ${extractUserIdFromName(user.name)}` : undefined,
        state: State.NORMAL,
      };
    }
    return { filter: undefined, state: State.NORMAL };
  }, [location.pathname, currentUser]);

  // Fetch stats using the same filter as the memo list
  const { statistics, tags } = useFilteredMemoStats(filter, state);

  return (
    <section className="@container w-full min-h-full flex flex-col justify-start items-center">
      {!md && (
        <MobileHeader>
          <MemoExplorerDrawer context={context} statisticsData={statistics} tagCount={tags} />
        </MobileHeader>
      )}
      {md && (
        <div className={cn("fixed top-0 left-16 shrink-0 h-svh transition-all", "border-r border-border", lg ? "w-72" : "w-56")}>
          <MemoExplorer className={cn("px-3 py-6")} context={context} statisticsData={statistics} tagCount={tags} />
        </div>
      )}
      <div className={cn("w-full min-h-full", lg ? "pl-72" : md ? "pl-56" : "")}>
        <div className={cn("w-full mx-auto px-4 sm:px-6 md:pt-6 pb-8")}>
          <Outlet />
        </div>
      </div>
    </section>
  );
});

export default MainLayout;
