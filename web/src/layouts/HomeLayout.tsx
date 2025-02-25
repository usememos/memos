import { observer } from "mobx-react-lite";
import { Outlet } from "react-router-dom";
import { HomeSidebar, HomeSidebarDrawer } from "@/components/HomeSidebar";
import MobileHeader from "@/components/MobileHeader";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { cn } from "@/utils";

const HomeLayout = observer(() => {
  const { md, lg } = useResponsiveWidth();

  return (
    <section className="@container w-full min-h-full flex flex-col justify-start items-center">
      {!md && (
        <MobileHeader>
          <HomeSidebarDrawer />
        </MobileHeader>
      )}
      <div className={cn("w-full min-h-full flex flex-row justify-start items-start")}>
        {md && (
          <div
            className={cn(
              "sticky top-0 left-0 shrink-0 h-[100svh] transition-all",
              "border-r border-gray-200 dark:border-zinc-800",
              lg ? "px-5 w-72" : "px-4 w-56",
            )}
          >
            <HomeSidebar className={cn("py-6")} />
          </div>
        )}
        <div className={cn("w-full mx-auto px-4 sm:px-6 sm:pt-3 md:pt-6 pb-8", md && "max-w-3xl")}>
          <Outlet />
        </div>
      </div>
    </section>
  );
});

export default HomeLayout;
