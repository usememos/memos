import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import DemoBanner from "@/components/DemoBanner";

function Root() {
  return (
    <div className="w-full min-h-full bg-zinc-100 dark:bg-zinc-800">
      <div className="w-full h-auto flex flex-col justify-start items-center">
        <DemoBanner />
      </div>
      <div className="w-full max-w-6xl mx-auto flex flex-row justify-center items-start sm:px-4">
        <Header />
        <main className="w-auto max-w-full flex-grow shrink flex flex-col justify-start items-start">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Root;
