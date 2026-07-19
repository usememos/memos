import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { AUTH_REDIRECT_PARAM, buildAuthRoute, getSafeRedirectPath } from "@/utils/auth-redirect";
import { ROUTES } from "./routes";

/** Waits for instance settings used by public/auth pages to settle. */
export const RequireInstanceInitializationRoute = () => {
  const { isInitialized } = useInstance();
  return isInitialized ? <Outlet /> : null;
};

/** Keeps non-feed authenticated pages behind all display-sensitive settings. */
export const RequireFullInitializationRoute = () => {
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  return authInitialized && instanceInitialized ? <Outlet /> : null;
};

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
 * are redirected to the requested `redirect` target (when safe) or to `/`.
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
