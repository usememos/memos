import classNames from "classnames";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import useLocalStorage from "react-use/lib/useLocalStorage";
import Navigation from "@/components/Navigation";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import Loading from "@/pages/Loading";

function Root() {
  const { sm } = useResponsiveWidth();
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("navigation-collapsed", false);

  return (
    <div className="w-full min-h-full">
      <div
        className={classNames(
          "w-full transition-all mx-auto flex flex-row justify-center items-start",
          collapsed ? "sm:pl-16" : "sm:pl-56"
        )}
      >
        {sm && (
          <div
            className={classNames(
              "hidden sm:block fixed top-0 left-0 select-none border-r dark:border-zinc-800 h-full bg-zinc-50 dark:bg-zinc-800 dark:bg-opacity-40 transition-all hover:shadow-xl z-2",
              collapsed ? "w-16 px-2" : "w-56 px-4"
            )}
            onDoubleClick={() => setCollapsed(!collapsed)}
          >
            <Navigation collapsed={collapsed} />
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
}

export default Root;
