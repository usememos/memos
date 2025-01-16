import clsx from "clsx";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import { useUserStatsStore } from "@/store/v1";
import TagsSection from "../HomeSidebar/TagsSection";
import StatisticsView from "../StatisticsView";

interface Props {
  className?: string;
}

const ExploreSidebar = (props: Props) => {
  const userStatsStore = useUserStatsStore();

  useDebounce(
    async () => {
      await userStatsStore.listUserStats();
    },
    300,
    [userStatsStore.stateId],
  );

  return (
    <aside
      className={clsx(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        props.className,
      )}
    >
      <SearchBar />
      <StatisticsView />
      <TagsSection readonly={true} />
    </aside>
  );
};

export default ExploreSidebar;
