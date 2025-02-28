import { observer } from "mobx-react-lite";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import usePrevious from "react-use/lib/usePrevious";
import Navigation from "@/components/Navigation";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import Loading from "@/pages/Loading";
import { Routes } from "@/router";
import { useMemoFilterStore } from "@/store/v1";
import { workspaceStore } from "@/store/v2";
import { cn } from "@/utils";

const RootLayout = observer(() => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { sm } = useResponsiveWidth();
  const currentUser = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();
  const [initialized, setInitialized] = useState(false);
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const prevPathname = usePrevious(pathname);

  useEffect(() => {
    if (!currentUser) {
      // If disallowPublicVisibility is enabled, redirect to the login page if the user is not logged in.
      if (workspaceStore.state.memoRelatedSetting.disallowPublicVisibility) {
        window.location.href = Routes.AUTH;
        return;
      } else if (([Routes.ROOT, Routes.RESOURCES, Routes.INBOX, Routes.ARCHIVED, Routes.SETTING] as string[]).includes(location.pathname)) {
        window.location.href = Routes.EXPLORE;
        return;
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    // When the route changes and there is no filter in the search params, remove all filters.
    if (prevPathname !== pathname && !searchParams.has("filter")) {
      memoFilterStore.removeFilter(() => true);
    }
  }, [prevPathname, pathname, searchParams]);

  return !initialized ? (
    <Loading />
  ) : (
    <div className="w-full min-h-full">
      <div className={cn("w-full transition-all mx-auto flex flex-row justify-center items-start", "sm:pl-16")}>
        {sm && (
          <div
            className={cn(
              "group flex flex-col justify-start items-start fixed top-0 left-0 select-none border-r dark:border-zinc-800 h-full bg-zinc-100 dark:bg-zinc-800 dark:bg-opacity-40 transition-all hover:shadow-xl z-2",
              "w-16 px-2",
            )}
          >
            <Navigation collapsed={true} />
          </div>
        )}
        <main className="w-full h-auto flex-grow shrink flex flex-col justify-start items-center">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
});

export default RootLayout;
