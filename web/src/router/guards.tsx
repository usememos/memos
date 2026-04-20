import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { AUTH_REDIRECT_PARAM, buildAuthRoute, getSafeRedirectPath } from "@/utils/auth-redirect";
import { ROUTES } from "./routes";

/**
 * Entry-route component mounted at `/`. Performs authentication-aware redirection
 * to the correct landing page before any business UI renders, preserving the
 * original query string and hash so bookmarks like `/?filter=foo` keep working.
 */
export const LandingRoute = () => {
  const currentUser = useCurrentUser();
  const location = useLocation();
  const target = currentUser ? ROUTES.HOME : ROUTES.EXPLORE;

  return (
    <Navigate
      to={{
        pathname: target,
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
};

/**
 * Guard for routes that require an authenticated user. Unauthenticated visitors
 * are redirected to `/auth` with the original location preserved as the `redirect`
 * query parameter, so they return to the intended page after signing in.
 */
export const RequireAuthRoute = () => {
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (!currentUser) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildAuthRoute({ redirect })} replace />;
  }

  return <Outlet />;
};

/**
 * Guard for guest-only routes (sign-in and sign-up). Already-authenticated users
 * are redirected to the requested `redirect` target (when safe) or to `/home`.
 *
 * The OAuth callback route (`/auth/callback`) intentionally opts out of this guard:
 * an authenticated session in another tab must not prevent the callback from
 * consuming its one-time OAuth state and completing the in-flight sign-in.
 */
export const RequireGuestRoute = () => {
  const currentUser = useCurrentUser();
  const [searchParams] = useSearchParams();

  if (currentUser) {
    const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
    return <Navigate to={redirectTarget || ROUTES.HOME} replace />;
  }

  return <Outlet />;
};
