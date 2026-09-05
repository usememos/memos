import { ROUTES } from "@/router/routes";

export type MemoScope = "home" | "explore" | "archived";
export type PrimaryMemoScope = Exclude<MemoScope, "archived">;

export const BUILTIN_TASKS_VIEW_ID = "__built_in_tasks__";
export const BUILTIN_TASKS_VIEW_FILTER = "has_task_list && has_incomplete_tasks";

export const getMemoViewId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : name;
};

const cleanPathname = (value: string): string => {
  const pathname = value.split(/[?#]/, 1)[0] || ROUTES.HOME;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
};

export const isMemoScopeRoute = (pathname: string): boolean => {
  const comparablePath = cleanPathname(pathname).toLowerCase();
  return comparablePath === ROUTES.HOME || comparablePath === ROUTES.EXPLORE || comparablePath === ROUTES.ARCHIVED;
};

const PROFILE_ROUTE_PATTERN = /^\/u\/([^/]+)$/i;

/** The decoded username when `pathname` is a user profile (`/u/:username`), else undefined. */
export const getProfileUsername = (pathname: string): string | undefined => {
  const match = cleanPathname(pathname).match(PROFILE_ROUTE_PATTERN);
  return match ? decodeURIComponent(match[1]) : undefined;
};

/** `/calendar` and any month or day beneath it. */
export const isCalendarRoute = (pathname: string): boolean => {
  const comparablePath = cleanPathname(pathname).toLowerCase();
  return comparablePath === ROUTES.CALENDAR || comparablePath.startsWith(`${ROUTES.CALENDAR}/`);
};

/**
 * Routes that render a memo collection the sidebar can narrow: the scope routes, a user
 * profile and the calendar. Views, calendar days and tags apply in place on all of them.
 * This is a different question from `isMemoCollectionOrigin` (MemoView/navigation.ts),
 * which asks whether returning to a route should keep the remembered Space.
 */
export const isMemoCollectionRoute = (pathname: string): boolean =>
  isMemoScopeRoute(pathname) || getProfileUsername(pathname) !== undefined || isCalendarRoute(pathname);

export const getMemoScopePath = (scope: PrimaryMemoScope): string => {
  if (scope === "explore") return ROUTES.EXPLORE;
  return ROUTES.HOME;
};

interface ResolveMemoScopeOptions {
  currentUsername?: string;
  detailFrom?: string;
  memoArchived?: boolean;
  fallback?: MemoScope;
}

export const resolveMemoScope = (pathname: string, options: ResolveMemoScopeOptions = {}): MemoScope => {
  const cleanPath = cleanPathname(pathname);
  const comparablePath = cleanPath.toLowerCase();
  if (comparablePath === ROUTES.EXPLORE) return "explore";
  if (comparablePath === ROUTES.ARCHIVED) return "archived";
  if (comparablePath === ROUTES.HOME) return "home";

  const profileUsername = getProfileUsername(cleanPath);
  if (profileUsername !== undefined) {
    return options.currentUsername && profileUsername === options.currentUsername ? "home" : "explore";
  }

  if (comparablePath.startsWith("/memos/") && options.detailFrom) {
    return resolveMemoScope(options.detailFrom, {
      currentUsername: options.currentUsername,
      fallback: options.fallback,
    });
  }

  if (comparablePath.startsWith("/memos/") && options.memoArchived) {
    return "archived";
  }

  return options.fallback ?? "home";
};
