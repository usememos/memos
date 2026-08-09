import { ROUTES } from "@/router/routes";

export type MemoScope = "home" | "explore" | "archived";

export const BUILTIN_TASKS_VIEW_ID = "__built_in_tasks__";
export const BUILTIN_TASKS_VIEW_FILTER = "has_task_list && has_incomplete_tasks";

export const getMemoViewId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : name;
};

export const isMemoScopeRoute = (pathname: string): boolean =>
  pathname === ROUTES.HOME || pathname === ROUTES.EXPLORE || pathname === ROUTES.ARCHIVED;

export const getMemoScopePath = (scope: MemoScope): string => {
  if (scope === "explore") return ROUTES.EXPLORE;
  if (scope === "archived") return ROUTES.ARCHIVED;
  return ROUTES.HOME;
};

const cleanPathname = (value: string): string => value.split(/[?#]/, 1)[0] || ROUTES.HOME;

interface ResolveMemoScopeOptions {
  currentUsername?: string;
  detailFrom?: string;
  memoArchived?: boolean;
  fallback?: MemoScope;
}

export const resolveMemoScope = (pathname: string, options: ResolveMemoScopeOptions = {}): MemoScope => {
  const cleanPath = cleanPathname(pathname);
  if (cleanPath === ROUTES.EXPLORE) return "explore";
  if (cleanPath === ROUTES.ARCHIVED) return "archived";
  if (cleanPath === ROUTES.HOME) return "home";

  const profileMatch = cleanPath.match(/^\/u\/([^/]+)$/);
  if (profileMatch) {
    return options.currentUsername && decodeURIComponent(profileMatch[1]) === options.currentUsername ? "home" : "explore";
  }

  if (cleanPath.startsWith("/memos/") && options.detailFrom) {
    return resolveMemoScope(options.detailFrom, {
      currentUsername: options.currentUsername,
      fallback: options.fallback,
    });
  }

  if (cleanPath.startsWith("/memos/") && options.memoArchived) {
    return "archived";
  }

  return options.fallback ?? "home";
};
