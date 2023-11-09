import { Outlet } from "react-router-dom";
import DemoBanner from "@/components/DemoBanner";
import Navigation from "@/components/Navigation";

function Root() {
  return (
    <div className="w-full min-h-full bg-zinc-100 dark:bg-zinc-800">
      <div className="w-full h-auto flex flex-col justify-start items-center">
        <DemoBanner />
      </div>
      <div className="w-full max-w-6xl mx-auto flex flex-row justify-center items-start sm:px-4">
        <div className="hidden sm:block sticky top-0 left-0 w-56">
          <Navigation />
        </div>
        <main className="w-full min-h-screen sm:max-w-[calc(100%-14rem)] flex-grow shrink flex flex-col justify-start items-start">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Root;
