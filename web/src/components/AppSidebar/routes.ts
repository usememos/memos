import { matchPath } from "react-router-dom";
import { getProfileUsername, isMemoScopeRoute, type MemoScope, resolveMemoScope } from "@/lib/memo-views";
import { ROUTES } from "@/router/routes";

export type SidebarRouteKind = MemoScope | "profile" | "views" | "attachments" | "inbox" | "settings" | "memo" | "common";

export type RouteSearchScope = "remembered-collection" | "user-collection" | "profile" | "all";
export type RouteComposePlacement = "remembered-space" | "unassigned";

export interface RouteActionPolicy {
  searchScope: RouteSearchScope;
  /** When absent, Quick Find stays on the current route. */
  searchDestination?: string;
  composePlacement: RouteComposePlacement;
}

export const getSidebarRouteKind = (path: string): SidebarRouteKind => {
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (isMemoScopeRoute(normalizedPath)) return resolveMemoScope(normalizedPath);
  if (getProfileUsername(normalizedPath) !== undefined) return "profile";
  if (matchPath(ROUTES.VIEWS, normalizedPath)) return "views";
  if (matchPath(ROUTES.ATTACHMENTS, normalizedPath)) return "attachments";
  if (matchPath(ROUTES.INBOX, normalizedPath)) return "inbox";
  if (matchPath(ROUTES.SETTING, normalizedPath)) return "settings";
  if (matchPath("/memos/:uid", normalizedPath) || matchPath(`${ROUTES.SHARED_MEMO}/:token`, normalizedPath)) return "memo";
  return "common";
};

/** Routes whose collections are filtered by the remembered All / Space scope. */
export const routeSupportsCollectionScope = (path: string): boolean => {
  const kind = getSidebarRouteKind(path);
  return kind === "home" || kind === "explore" || kind === "attachments";
};

/**
 * Keeps read/search scope and write placement explicit at route boundaries.
 * A remembered Space is ambient collection state, so global and canonical
 * resource routes must not silently use it as a creation target.
 */
export const getRouteActionPolicy = (path: string): RouteActionPolicy => {
  const kind = getSidebarRouteKind(path);

  if (kind === "home" || kind === "explore") {
    return {
      searchScope: "remembered-collection",
      composePlacement: "remembered-space",
    };
  }

  if (kind === "archived") {
    return {
      searchScope: "user-collection",
      composePlacement: "unassigned",
    };
  }

  if (kind === "attachments") {
    return {
      searchScope: "remembered-collection",
      searchDestination: ROUTES.HOME,
      composePlacement: "remembered-space",
    };
  }

  if (kind === "profile") {
    return {
      searchScope: "profile",
      // Re-enter the memo list tab on the same profile (dropping ?view=map).
      searchDestination: path.length > 1 ? path.replace(/\/+$/, "") : path,
      composePlacement: "unassigned",
    };
  }

  return {
    searchScope: "all",
    searchDestination: ROUTES.HOME,
    composePlacement: "unassigned",
  };
};
