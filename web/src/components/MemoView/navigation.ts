import { getProfileUsername, isMemoScopeRoute } from "@/lib/memo-views";
import { ROUTES } from "@/router/routes";

export type MemoOriginScope = "all" | "preserve";

export interface MemoNavigationState {
  from: string;
  fromScope: MemoOriginScope;
}

interface ResolveMemoDetailOriginOptions {
  memoArchived?: boolean;
}

interface ResolveMemoParentPageOptions {
  explicitParentPage?: string;
  explicitParentScope?: MemoOriginScope;
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

/** Whether returning from this collection should preserve the remembered All / Space state. */
export const isMemoCollectionOrigin = (page: string): boolean => {
  const pathname = page.split(/[?#]/, 1)[0] || ROUTES.HOME;
  return isMemoScopeRoute(pathname) || normalizePathname(pathname) === ROUTES.ATTACHMENTS;
};

export const createMemoNavigationState = (from: string, fromScope: MemoOriginScope): MemoNavigationState => ({ from, fromScope });

/** Reads router state while remaining compatible with older `{ from }` links. */
export const resolveMemoDetailOrigin = (
  state: unknown,
  options: ResolveMemoDetailOriginOptions = {},
): { parentPage: string; parentScope: MemoOriginScope } => {
  const value = state && typeof state === "object" ? (state as { from?: unknown; fromScope?: unknown }) : undefined;
  const explicitParentPage = typeof value?.from === "string" ? value.from : undefined;
  const hasExplicitParent = explicitParentPage !== undefined;
  const parentPage = explicitParentPage || (options.memoArchived ? ROUTES.ARCHIVED : ROUTES.HOME);
  const parentScope =
    value?.fromScope === "all" || value?.fromScope === "preserve"
      ? value.fromScope
      : hasExplicitParent && isMemoCollectionOrigin(parentPage)
        ? "preserve"
        : options.memoArchived
          ? "preserve"
          : "all";
  return { parentPage, parentScope };
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
export const resolveMemoOrigin = ({
  explicitParentPage,
  explicitParentScope,
  pathname,
  search,
  memoName,
}: ResolveMemoParentPageOptions): { parentPage: string; parentScope: MemoOriginScope } => {
  if (explicitParentPage !== undefined) {
    const parentPage = explicitParentPage || ROUTES.HOME;
    return {
      parentPage,
      parentScope: explicitParentScope ?? (isMemoCollectionOrigin(parentPage) ? "preserve" : "all"),
    };
  }

  if (isMemoDetailPath(pathname, memoName)) {
    return { parentPage: ROUTES.HOME, parentScope: "all" };
  }

  return {
    parentPage: `${pathname}${search}`,
    parentScope: isMemoCollectionOrigin(pathname) ? "preserve" : "all",
  };
};

export const resolveMemoParentPage = (options: ResolveMemoParentPageOptions): string => resolveMemoOrigin(options).parentPage;

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
