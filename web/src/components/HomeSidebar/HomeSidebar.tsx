import { last } from "lodash-es";
import { observer } from "mobx-react-lite";
import { matchPath, useLocation } from "react-router-dom";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { memoStore, userStore } from "@/store/v2";
import { cn } from "@/utils";
import MemoFilters from "../MemoFilters";
import StatisticsView from "../StatisticsView";
import ShortcutsSection from "./ShortcutsSection";
import TagsSection from "./TagsSection";

interface Props {
  className?: string;
}

const HomeSidebar = observer((props: Props) => {
  const location = useLocation();
  const currentUser = useCurrentUser();

  useDebounce(
    async () => {
      let parent: string | undefined = undefined;
      if (location.pathname === Routes.ROOT && currentUser) {
        parent = currentUser.name;
      }
      if (matchPath("/u/:username", location.pathname) !== null) {
        const username = last(location.pathname.split("/"));
        const user = await userStore.getOrFetchUserByUsername(username || "");
        parent = user.name;
      }
      await userStore.fetchUserStats(parent);
    },
    300,
    [memoStore.state.memos.length, userStore.state.statsStateId, location.pathname],
  );

  return (
    <aside className={cn("relative w-full h-full overflow-auto flex flex-col justify-start items-start", props.className)}>
      <SearchBar />
      <div className="mt-1 px-1 w-full">
        <StatisticsView />
        <MemoFilters />
        {currentUser && <ShortcutsSection />}
        <TagsSection />
      </div>
    </aside>
  );
});

export default HomeSidebar;
