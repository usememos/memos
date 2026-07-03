import { Navigate, Outlet, useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { ROUTES } from "./routes";

/**
 * Index-route gate mounted at `/`. Authenticated visitors fall through to the
 * nested Home page; unauthenticated visitors are redirected to `/explore`,
 * preserving the original query string and hash so bookmarks like `/?filter=foo`
 * keep working.
 */
export const LandingRoute = () => {
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (!currentUser) {
    return (
      <Navigate
        to={{
          pathname: ROUTES.EXPLORE,
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  return <Outlet />;
};

/**
 * Guard for routes that require an authenticated user. Authentication is
 * handled by Cloudflare Access: a full page load on a protected path triggers
 * the Access login flow. Client-side navigation bypasses the server, so an
 * anonymous visitor (who arrived via a public bypassed path) is sent through
 * a full reload to let Access authenticate them.
 */
export const RequireAuthRoute = () => {
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (!currentUser) {
    window.location.assign(`${location.pathname}${location.search}${location.hash}`);
    return null;
  }

  return <Outlet />;
};
