import { observer } from "mobx-react-lite";
import SearchBar from "@/components/SearchBar";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import type { StatisticsData } from "@/types/statistics";
import StatisticsView from "../StatisticsView";
import ShortcutsSection from "./ShortcutsSection";
import TagsSection from "./TagsSection";

export type MemoExplorerContext = "home" | "explore" | "archived" | "profile";

export interface MemoExplorerFeatures {
  /**
   * Show search bar at the top
   * Default: true
   */
  search?: boolean;

  /**
   * Show statistics section (activity calendar + stat cards)
   * Default: true
   */
  statistics?: boolean;

  /**
   * Show shortcuts section (user-defined filter shortcuts)
   * Default: true for authenticated users on home/profile, false for explore
   */
  shortcuts?: boolean;

  /**
   * Show tags section
   * Default: true
   */
  tags?: boolean;

  /**
   * Context for statistics view (affects which stats to show)
   * Default: "user"
   */
  statisticsContext?: MemoExplorerContext;
}

interface Props {
  className?: string;

  /**
   * Context for the explorer (determines default features)
   */
  context?: MemoExplorerContext;

  /**
   * Feature configuration (overrides context defaults)
   */
  features?: MemoExplorerFeatures;

  /**
   * Statistics data computed from filtered memos
   * Should be computed using useFilteredMemoStats with the same filter as the memo list
   */
  statisticsData: StatisticsData;

  /**
   * Tag counts computed from filtered memos
   * Should be computed using useFilteredMemoStats with the same filter as the memo list
   */
  tagCount: Record<string, number>;
}

/**
 * Default features based on context
 */
const getDefaultFeatures = (context: MemoExplorerContext): MemoExplorerFeatures => {
  switch (context) {
    case "explore":
      return {
        search: true,
        statistics: true,
        shortcuts: false, // Global explore doesn't use shortcuts
        tags: true,
        statisticsContext: "explore",
      };
    case "archived":
      return {
        search: true,
        statistics: true,
        shortcuts: false, // Archived doesn't typically use shortcuts
        tags: true,
        statisticsContext: "archived",
      };
    case "profile":
      return {
        search: true,
        statistics: true,
        shortcuts: false, // Profile view doesn't use shortcuts
        tags: true,
        statisticsContext: "profile",
      };
    case "home":
    default:
      return {
        search: true,
        statistics: true,
        shortcuts: true,
        tags: true,
        statisticsContext: "home",
      };
  }
};

const MemoExplorer = observer((props: Props) => {
  const { className, context = "home", features: featureOverrides = {}, statisticsData, tagCount } = props;
  const currentUser = useCurrentUser();

  // Merge default features with overrides
  const features = {
    ...getDefaultFeatures(context),
    ...featureOverrides,
  };

  return (
    <aside
      className={cn(
        "relative w-full h-full overflow-auto flex flex-col justify-start items-start bg-background text-sidebar-foreground",
        className,
      )}
    >
      {features.search && <SearchBar />}
      <div className="mt-1 px-1 w-full">
        {features.statistics && <StatisticsView context={features.statisticsContext} statisticsData={statisticsData} />}
        {features.shortcuts && currentUser && <ShortcutsSection />}
        {features.tags && <TagsSection readonly={context === "explore"} tagCount={tagCount} />}
      </div>
    </aside>
  );
});

export default MemoExplorer;
