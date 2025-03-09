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
      {md && (
        <div
          className={cn(
            "fixed top-0 left-16 shrink-0 h-[100svh] transition-all",
            "border-r border-gray-200 dark:border-zinc-800",
            lg ? "w-72" : "w-56",
          )}
        >
          <HomeSidebar className={cn("px-3 py-6")} />
        </div>
      )}
      <div className={cn("w-full min-h-full", lg ? "pl-72" : md ? "pl-56" : "")}>
        <div className={cn("w-full mx-auto px-4 sm:px-6 md:pt-6 pb-8")}>
          <Outlet />
        </div>
      </div>
    </section>
  );
});

export default HomeLayout;
