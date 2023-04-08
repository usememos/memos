import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import UpgradeVersionBanner from "@/components/UpgradeVersionBanner";

function Root() {
  return (
    <div className="w-full min-h-full bg-zinc-100 dark:bg-zinc-800">
      <div className="w-full h-auto flex flex-col justify-start items-center">
        <UpgradeVersionBanner />
      </div>
      <div className="w-full max-w-6xl mx-auto flex flex-row justify-center items-start">
        <Header />
        <main className="w-auto flex-grow flex flex-col justify-start items-start">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Root;
