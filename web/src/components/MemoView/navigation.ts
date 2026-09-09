import { getProfileUsername } from "@/lib/memo-views";
import { ROUTES } from "@/router/routes";

export interface MemoNavigationState {
  from: string;
}

interface ResolveMemoDetailOriginOptions {
  memoArchived?: boolean;
}

interface ResolveMemoParentPageOptions {
  explicitParentPage?: string;
  pathname: string;
  search: string;
  memoName: string;
}

const normalizePathname = (pathname: string): string => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return normalized.toLowerCase();
};

/** Whether the current route is any canonical or shared Memo detail page. */
export const isMemoResourcePath = (pathname: string): boolean => {
  const normalizedPath = normalizePathname(pathname);
  const sharedMemoPrefix = `${ROUTES.SHARED_MEMO}/`;
  if (normalizedPath.startsWith(sharedMemoPrefix)) {
    const shareToken = normalizedPath.slice(sharedMemoPrefix.length);
    return shareToken.length > 0 && !shareToken.includes("/");
  }

  const directMemoPrefix = "/memos/";
  if (!normalizedPath.startsWith(directMemoPrefix)) return false;
  const memoID = normalizedPath.slice(directMemoPrefix.length);
  return memoID.length > 0 && !memoID.includes("/");
};

export const createMemoNavigationState = (from: string): MemoNavigationState => ({ from });

/** Reads the origin page out of router state; without one, a detail returns to its collection. */
export const resolveMemoDetailOrigin = (state: unknown, options: ResolveMemoDetailOriginOptions = {}): string => {
  const value = state && typeof state === "object" ? (state as { from?: unknown }) : undefined;
  const explicitParentPage = typeof value?.from === "string" ? value.from : undefined;
  return explicitParentPage || (options.memoArchived ? ROUTES.ARCHIVED : ROUTES.HOME);
};

/** Whether the current route is the canonical detail page for this memo. */
export const isMemoDetailPath = (pathname: string, memoName: string): boolean => {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === `/${memoName}`.toLowerCase()) return true;
  return normalizedPath.startsWith(`${ROUTES.SHARED_MEMO}/`) && isMemoResourcePath(normalizedPath);
};

/**
 * Captures the list page that opened a memo so canonical detail routes can
 * return to the real collection lens instead of assuming Home.
 */
export const resolveMemoParentPage = ({ explicitParentPage, pathname, search, memoName }: ResolveMemoParentPageOptions): string => {
  if (explicitParentPage !== undefined) return explicitParentPage || ROUTES.HOME;
  if (isMemoDetailPath(pathname, memoName)) return ROUTES.HOME;
  return `${pathname}${search}`;
};

/** Replaces only the memo filter while preserving the rest of the origin query. */
export const withMemoFilter = (page: string, filter: string): string => {
  const [pathAndSearch] = page.split("#", 1);
  const questionMark = pathAndSearch.indexOf("?");
  const pathname = questionMark === -1 ? pathAndSearch : pathAndSearch.slice(0, questionMark);
  const search = questionMark === -1 ? "" : pathAndSearch.slice(questionMark + 1);
  const searchParams = new URLSearchParams(search);
  if (getProfileUsername(pathname) !== undefined && searchParams.get("view") === "map") {
    searchParams.delete("view");
  }
  searchParams.set("filter", filter);
  return `${pathname || ROUTES.HOME}?${searchParams.toString()}`;
};
