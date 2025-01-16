import clsx from "clsx";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import StatisticsView from "@/components/StatisticsView";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoList, useUserStatsStore } from "@/store/v1";
import TagsSection from "./TagsSection";

interface Props {
  className?: string;
}

const HomeSidebar = (props: Props) => {
  const currentUser = useCurrentUser();
  const memoList = useMemoList();
  const userStatsStore = useUserStatsStore();

  useDebounce(
    async () => {
      await userStatsStore.listUserStats(currentUser.name);
    },
    300,
    [memoList.size(), userStatsStore.stateId, currentUser],
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
      <TagsSection />
    </aside>
  );
};

export default HomeSidebar;
