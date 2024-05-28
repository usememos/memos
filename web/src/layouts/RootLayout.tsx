import { Button, IconButton, Tooltip } from "@mui/joy";
import clsx from "clsx";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import useLocalStorage from "react-use/lib/useLocalStorage";
import Icon from "@/components/Icon";
import Navigation from "@/components/Navigation";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import Loading from "@/pages/Loading";
import { Routes } from "@/router";

const RootLayout = () => {
  const location = useLocation();
  const { sm } = useResponsiveWidth();
  const currentUser = useCurrentUser();
  const [lastVisited] = useLocalStorage<string>("lastVisited", "/home");
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("navigation-collapsed", false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      if (
        ([Routes.ROOT, Routes.HOME, Routes.TIMELINE, Routes.RESOURCES, Routes.INBOX, Routes.ARCHIVED, Routes.SETTING] as string[]).includes(
          location.pathname,
        )
      ) {
        window.location.href = Routes.EXPLORE;
        return;
      }
    } else {
      if (location.pathname === Routes.ROOT) {
        if (lastVisited && ([Routes.HOME, Routes.TIMELINE] as string[]).includes(lastVisited)) {
          window.location.href = lastVisited;
        } else {
          window.location.href = Routes.HOME;
        }
        return;
      }
    }

    setInitialized(true);
  }, []);

  return !initialized ? (
    <Loading />
  ) : (
    <div className="w-full min-h-full">
      <div className={clsx("w-full transition-all mx-auto flex flex-row justify-center items-start", collapsed ? "sm:pl-16" : "sm:pl-56")}>
        {sm && (
          <div
            className={clsx(
              "group flex flex-col justify-start items-start fixed top-0 left-0 select-none border-r dark:border-zinc-800 h-full bg-zinc-50 dark:bg-zinc-800 dark:bg-opacity-40 transition-all hover:shadow-xl z-2",
              collapsed ? "w-16 px-2" : "w-56 px-4",
            )}
          >
            <Navigation className="!h-auto" collapsed={collapsed} />
            <div className={clsx("w-full grow h-auto flex flex-col justify-end", collapsed ? "items-center" : "items-start")}>
              <div
                className={clsx("hidden py-3 group-hover:flex flex-col justify-center items-center")}
                onClick={() => setCollapsed(!collapsed)}
              >
                {!collapsed ? (
                  <Button variant="plain" color="neutral" startDecorator={<Icon.ChevronLeft className="w-5 h-auto opacity-70" />}>
                    Collapse
                  </Button>
                ) : (
                  <Tooltip title="Expand" placement="right" arrow>
                    <IconButton>
                      <Icon.ChevronRight className="w-5 h-auto opacity-70" />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
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
};

export default RootLayout;
