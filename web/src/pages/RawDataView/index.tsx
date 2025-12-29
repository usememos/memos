import clsx from "clsx";
import { BookIcon, LeafIcon, VideoIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Routes } from "@/router";

interface TabItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

const RawDataView = () => {
  const tabs: TabItem[] = [
    {
      id: "pet",
      path: `${Routes.RAW_DATA_VIEW}/pet`,
      label: "Pet",
      icon: <LeafIcon className="w-5 h-5" />,
    },
    {
      id: "book",
      path: `${Routes.RAW_DATA_VIEW}/book`,
      label: "Book",
      icon: <BookIcon className="w-5 h-5" />,
    },
    {
      id: "video",
      path: `${Routes.RAW_DATA_VIEW}/video`,
      label: "Video",
      icon: <VideoIcon className="w-5 h-5" />,
    },
  ];

  return (
    <section className="@container w-full min-h-full flex flex-col justify-start items-start">
      {/* Top Navigation Bar */}
      <div className="w-full border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="w-full px-4 sm:px-6 py-3">
          <div className="flex flex-row gap-2 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                    "text-sm font-medium whitespace-nowrap",
                    "hover:bg-gray-100 dark:hover:bg-zinc-800",
                    isActive ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400",
                  )
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex-1 px-4 sm:px-6 py-4">
        <Outlet />
      </div>
    </section>
  );
};

export default RawDataView;
