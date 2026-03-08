import { clearAccessToken } from "@/auth-state";
import { ROUTES } from "@/router/routes";

const PUBLIC_ROUTES = [
  ROUTES.AUTH, // Authentication pages
  ROUTES.EXPLORE, // Explore page
  "/u/", // User profile pages (dynamic)
  "/memos/", // Individual memo detail pages (dynamic)
] as const;

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

export function redirectOnAuthFailure(forceRedirect = false): void {
  const currentPath = window.location.pathname;

  // Already on auth page, nothing to do.
  if (currentPath.startsWith(ROUTES.AUTH)) {
    return;
  }

  // Don't redirect if it's a public route (unless forced, e.g. public visibility is disallowed).
  if (!forceRedirect && isPublicRoute(currentPath)) {
    return;
  }

  clearAccessToken();
  window.location.replace(ROUTES.AUTH);
}
