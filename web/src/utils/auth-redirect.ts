import { clearAccessToken } from "@/auth-state";
import { ROUTES } from "@/router/routes";

const PUBLIC_ROUTES = [
  ROUTES.AUTH, // Authentication pages
  ROUTES.EXPLORE, // Explore page
  ROUTES.SHARED_MEMO + "/", // Shared memo pages (share-link viewer)
  "/u/", // User profile pages (dynamic)
  "/memos/", // Individual memo detail pages (dynamic)
] as const;

export const AUTH_REDIRECT_PARAM = "redirect";
export const AUTH_REASON_PARAM = "reason";
export const AUTH_REASON_PROTECTED_MEMO = "protected-memo";

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

export function getSafeRedirectPath(path: string | null | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  if (!path.startsWith("/") || path.startsWith("//")) {
    return undefined;
  }

  return path;
}

export function buildAuthRoute(options?: { redirect?: string | null; reason?: string | null }): string {
  const searchParams = new URLSearchParams();
  const redirectPath = getSafeRedirectPath(options?.redirect);

  if (redirectPath) {
    searchParams.set(AUTH_REDIRECT_PARAM, redirectPath);
  }

  if (options?.reason) {
    searchParams.set(AUTH_REASON_PARAM, options.reason);
  }

  const search = searchParams.toString();
  return search ? `${ROUTES.AUTH}?${search}` : ROUTES.AUTH;
}

export function redirectOnAuthFailure(
  forceRedirect = false,
  options?: {
    redirect?: string | null;
    reason?: string | null;
  },
): void {
  const currentPath = window.location.pathname;
  const currentRedirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  // Already on auth page, nothing to do.
  if (currentPath.startsWith(ROUTES.AUTH)) {
    return;
  }

  // Don't redirect if it's a public route (unless forced, e.g. public visibility is disallowed).
  if (!forceRedirect && isPublicRoute(currentPath)) {
    return;
  }

  clearAccessToken();
  window.location.replace(
    buildAuthRoute({
      ...options,
      redirect: options?.redirect ?? currentRedirectPath,
    }),
  );
}
