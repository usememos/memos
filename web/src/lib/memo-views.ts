import { ROUTES } from "@/router/routes";

export type MemoScope = "home" | "explore" | "archived";

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

export const getMemoScopePath = (scope: MemoScope): string => {
  if (scope === "explore") return ROUTES.EXPLORE;
  if (scope === "archived") return ROUTES.ARCHIVED;
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

  const profileMatch = cleanPath.match(/^\/u\/([^/]+)$/i);
  if (profileMatch) {
    return options.currentUsername && decodeURIComponent(profileMatch[1]) === options.currentUsername ? "home" : "explore";
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
