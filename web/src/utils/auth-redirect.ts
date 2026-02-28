import { clearAccessToken } from "@/auth-state";
import { ROUTES } from "@/router/routes";

const PUBLIC_ROUTES = [
  ROUTES.AUTH, // Authentication pages
  ROUTES.EXPLORE, // Explore page
  "/u/", // User profile pages (dynamic)
  "/memos/", // Individual memo detail pages (dynamic)
] as const;

const PRIVATE_ROUTES = [ROUTES.ROOT, ROUTES.ATTACHMENTS, ROUTES.INBOX, ROUTES.ARCHIVED, ROUTES.SETTING] as const;

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

function isPrivateRoute(path: string): boolean {
  return PRIVATE_ROUTES.includes(path as (typeof PRIVATE_ROUTES)[number]);
}

export function redirectOnAuthFailure(): void {
  const currentPath = window.location.pathname;

  // Don't redirect if it's a public route
  if (isPublicRoute(currentPath)) {
    return;
  }

  // Always redirect to auth page on auth failure - the user's session expired
  // and they should re-authenticate rather than being sent to explore.
  if (isPrivateRoute(currentPath)) {
    clearAccessToken();
    window.location.replace(ROUTES.AUTH);
  }
}
