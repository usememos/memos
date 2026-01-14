import { Suspense, useEffect, useMemo } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import usePrevious from "react-use/lib/usePrevious";
import AIChatSidebar from "@/components/AIChatSidebar";
import Navigation from "@/components/Navigation";
import Spinner from "@/components/Spinner";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { redirectOnAuthFailure } from "@/utils/auth-redirect";

// Pages where AI sidebar should be visible
const AI_SIDEBAR_ALLOWED_PATHS = ["/", "/explore"];
const AI_SIDEBAR_ALLOWED_PREFIXES = ["/memos/"];

const RootLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sm = useMediaQuery("sm");
  const currentUser = useCurrentUser();
  const { memoRelatedSetting } = useInstance();
  const { removeFilter } = useMemoFilterContext();
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const prevPathname = usePrevious(pathname);

  // Check if AI sidebar should be shown on current page
  const showAISidebar = useMemo(() => {
    // Exact match for specific paths
    if (AI_SIDEBAR_ALLOWED_PATHS.includes(pathname)) {
      return true;
    }
    // Prefix match for paths like /memos/:uid
    return AI_SIDEBAR_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }, [pathname]);

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
        <Suspense
          fallback={
            <div className="w-full h-64 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* AI Chat Sidebar - only on allowed pages */}
      {showAISidebar && <AIChatSidebar />}
    </div>
  );
};

export default RootLayout;
