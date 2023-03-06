import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import UpdateVersionBanner from "../components/UpdateVersionBanner";

function Root() {
  return (
    <section className="w-full h-full overflow-y-auto bg-zinc-100 dark:bg-zinc-800">
      <div className="w-full flex flex-col justify-start items-center">
        <UpdateVersionBanner />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[14rem_1fr] relative w-full max-w-6xl h-full mx-auto">
        <Header />
        <main className="relative w-full h-auto flex flex-col justify-start items-start">
          <Outlet />
        </main>
      </div>
    </section>
  );
}

export default Root;
