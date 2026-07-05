import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { buildAuthRoute, shouldGatePrivateInstance } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const MEMOS_DEPLOY_URL = "https://usememos.com/docs/deploy";

const DemoBanner = () => {
  const t = useTranslate();

  return (
    <div className="static w-full border-b border-border bg-muted/70 px-4 py-2 text-sm text-muted-foreground sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-2">
        <span className="font-medium text-foreground">{t("demo.banner-title")}</span>
        <span>{t("demo.banner-description")}</span>
        <a className="font-medium text-primary underline-offset-4 hover:underline" href={MEMOS_DEPLOY_URL} target="_blank" rel="noreferrer">
          {t("demo.deploy-link")}
        </a>
      </div>
    </div>
  );
};

const RootLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sm = useMediaQuery("sm");
  const currentUser = useCurrentUser();
  const { profile } = useInstance();
  const { removeFilter } = useMemoFilterContext();
  const { pathname } = location;
  const prevPathnameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prevPathname = prevPathnameRef.current;

    // When the route changes and there is no filter in the search params, remove all filters.
    if (prevPathname !== undefined && prevPathname !== pathname && !searchParams.has("filter")) {
      removeFilter(() => true);
    }

    prevPathnameRef.current = pathname;
  }, [pathname, searchParams, removeFilter]);

  // Private instance (no InstanceURL configured): anonymous visitors may only reach
  // share links; everything else redirects to the sign-in page, preserving the intended
  // destination. Public instances keep the open Explore behavior for logged-out users.
  if (shouldGatePrivateInstance({ isPrivateInstance: !profile.instanceUrl, isAuthenticated: !!currentUser, pathname })) {
    const redirect = `${pathname}${location.search}${location.hash}`;
    return <Navigate to={buildAuthRoute({ redirect })} replace />;
  }

  return (
    <div className="w-full min-h-full flex flex-row justify-center items-start sm:pl-16">
      {sm && (
        <div
          className={cn(
            "group flex flex-col justify-start items-start fixed top-0 left-0 select-none h-full bg-sidebar",
            "w-16 px-2",
            "border-r border-border",
          )}
        >
          <Navigation className="py-4 md:pt-6" collapsed={true} />
        </div>
      )}
      <main className="w-full h-auto grow shrink flex flex-col justify-start items-center">
        {profile.demo && <DemoBanner />}
        <Outlet />
      </main>
    </div>
  );
};

export default RootLayout;
