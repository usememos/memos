import clsx from "clsx";
import { DropletIcon, NotepadTextIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useRawDataStore } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";
import CareEvents from "./CareEvents";

type PetView = "care-events" | "notes";

export interface PetData {
  nickname: string;
  species: string;
  endDate?: string;
  template?: boolean;
  notes?: Array<{
    images?: string[];
    text?: string;
    recordedAt?: string;
  }>;
  careEvents?: {
    watering?: string | string[];
    acidSupplement?: string | string[];
    fertilizing?: string | string[];
    rootingPowderUse?: string | string[];
    ironSupplement?: string | string[];
  };
}

export interface PetMemoWithData {
  memo: Memo;
  petData: PetData;
}

interface SubNavItem {
  id: PetView;
  label: string;
  icon: React.ReactNode;
}

const Pet = () => {
  const user = useCurrentUser();
  const rawDataStore = useRawDataStore();
  const petMemosWithData = rawDataStore.getPetMemos();
  const isLoading = rawDataStore.isLoading;
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active view from URL query params, default to "care-events"
  const activeView = (searchParams.get("view") as PetView) || "care-events";

  const subNavItems: SubNavItem[] = [
    {
      id: "care-events",
      label: "Care Events",
      icon: <DropletIcon className="w-4 h-4" />,
    },
    {
      id: "notes",
      label: "Notes",
      icon: <NotepadTextIcon className="w-4 h-4" />,
    },
  ];

  // Handle view change
  const handleViewChange = (view: PetView) => {
    setSearchParams({ view });
  };

  // Build filter string (following Home page pattern)
  const petFilter = useMemo(() => {
    if (!user) return "";

    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`, `tag_search == ["Raw/Pets"]`, `has_code == true`];

    return filters.join(" && ");
  }, [user]);

  // Fetch pet memos on component mount (only if not already cached)
  useEffect(() => {
    if (!user || !petFilter) return;

    // Only fetch if we don't have data cached
    if (petMemosWithData.length === 0 && !isLoading) {
      console.log("[Pet] Fetching pet memos with filter:", petFilter);
      rawDataStore.fetchRawMemos(petFilter, "pet");
    }
  }, [user, petFilter, petMemosWithData.length, isLoading]);

  if (!user) {
    return (
      <div className="w-full p-8 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to view pet data.</p>
      </div>
    );
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="w-full p-8 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">Loading pet data...</p>
        </div>
      );
    }

    if (petMemosWithData.length === 0) {
      return (
        <div className="w-full p-8 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No pet data found. Create a memo with tag #Raw/Pets and a JSON code block to get started.
          </p>
        </div>
      );
    }

    // Render based on active view
    switch (activeView) {
      case "care-events":
        return <CareEvents petMemosWithData={petMemosWithData} />;

      case "notes":
        return (
          <div className="w-full p-8 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 text-center">
            <p className="text-gray-500 dark:text-gray-400">Notes view - Coming soon</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {/* Secondary Navigation */}
      <div className="flex items-center justify-start mb-3 pb-2 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex gap-1">
          {subNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all",
                activeView === item.id
                  ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-zinc-700 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 border-transparent",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {renderContent()}
    </div>
  );
};

export default Pet;
