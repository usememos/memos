import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import usePrevious from "react-use/lib/usePrevious";
import Navigation from "@/components/Navigation";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { redirectOnAuthFailure } from "@/utils/auth-redirect";

const RootLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sm = useMediaQuery("sm");
  const currentUser = useCurrentUser();
  const { memoRelatedSetting } = useInstance();
  const { removeFilter } = useMemoFilterContext();
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const prevPathname = usePrevious(pathname);

  useEffect(() => {
    if (!currentUser && memoRelatedSetting.disallowPublicVisibility) {
      redirectOnAuthFailure();
    }
  }, [currentUser, memoRelatedSetting.disallowPublicVisibility]);

  useEffect(() => {
    // When the route changes and there is no filter in the search params, remove all filters
    if (prevPathname !== pathname && !searchParams.has("filter")) {
      removeFilter(() => true);
    }
  }, [prevPathname, pathname, searchParams, removeFilter]);

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
        <Outlet />
      </main>
    </div>
  );
};

export default RootLayout;
