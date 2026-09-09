import { matchPath } from "react-router-dom";
import { getProfileUsername, isCalendarRoute, isMemoScopeRoute, type MemoScope, resolveMemoScope } from "@/lib/memo-views";
import { collectionPathForLocation, ROUTES, resolveCollectionRoute } from "@/router/routes";

export type SidebarRouteKind = MemoScope | "profile" | "views" | "calendar" | "attachments" | "inbox" | "settings" | "memo" | "common";

export type RouteSearchScope = "route-collection" | "user-collection" | "profile" | "all";

export interface RouteActionPolicy {
  searchScope: RouteSearchScope;
  /** When absent, Quick Find stays on the current route. */
  searchDestination?: string;
}

export const getSidebarRouteKind = (path: string): SidebarRouteKind => {
  const normalizedPath = resolveCollectionRoute(path).pathname;
  if (isMemoScopeRoute(normalizedPath)) return resolveMemoScope(normalizedPath);
  if (getProfileUsername(normalizedPath) !== undefined) return "profile";
  if (matchPath(ROUTES.VIEWS, normalizedPath)) return "views";
  if (isCalendarRoute(normalizedPath)) return "calendar";
  if (matchPath(ROUTES.ATTACHMENTS, normalizedPath)) return "attachments";
  if (matchPath(ROUTES.INBOX, normalizedPath)) return "inbox";
  if (matchPath(ROUTES.SETTING, normalizedPath)) return "settings";
  if (matchPath("/memos/:uid", normalizedPath) || matchPath(`${ROUTES.SHARED_MEMO}/:token`, normalizedPath)) return "memo";
  return "common";
};

/**
 * Keeps read/search scope explicit at route boundaries. Compose placement needs no
 * policy: the URL only carries a Space on collection pages.
 */
export const getRouteActionPolicy = (path: string): RouteActionPolicy => {
  const kind = getSidebarRouteKind(path);

  if (kind === "home" || kind === "explore") return { searchScope: "route-collection" };
  if (kind === "archived") return { searchScope: "user-collection" };

  // Calendar and attachments browse the route collection but are not memo lists
  // themselves, so a search leaves for the same collection's Home.
  if (kind === "calendar" || kind === "attachments") {
    return { searchScope: "route-collection", searchDestination: collectionPathForLocation(ROUTES.HOME, path) };
  }

  if (kind === "profile") {
    // Re-enter the memo list tab on the same profile (dropping ?view=map).
    return { searchScope: "profile", searchDestination: path.length > 1 ? path.replace(/\/+$/, "") : path };
  }

  return { searchScope: "all", searchDestination: ROUTES.HOME };
};
