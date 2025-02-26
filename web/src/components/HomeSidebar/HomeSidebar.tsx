import { last } from "lodash-es";
import { Globe2Icon, HomeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { useMemoList } from "@/store/v1";
import { userStore } from "@/store/v2";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import MemoFilters from "../MemoFilters";
import StatisticsView from "../StatisticsView";
import ShortcutsSection from "./ShortcutsSection";
import TagsSection from "./TagsSection";

interface NavLinkItem {
  id: string;
  path: string;
  title: string;
  icon: React.ReactNode;
}

interface Props {
  className?: string;
}

const HomeSidebar = observer((props: Props) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const memoList = useMemoList();

  const homeNavLink: NavLinkItem = {
    id: "header-home",
    path: Routes.ROOT,
    title: t("common.home"),
    icon: <HomeIcon className="w-4 h-auto opacity-70 shrink-0" />,
  };
  const exploreNavLink: NavLinkItem = {
    id: "header-explore",
    path: Routes.EXPLORE,
    title: t("common.explore"),
    icon: <Globe2Icon className="w-4 h-auto opacity-70 shrink-0" />,
  };

  const navLinks: NavLinkItem[] = currentUser ? [homeNavLink, exploreNavLink] : [exploreNavLink];

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
    [memoList.size(), userStore.state.statsStateId, location.pathname],
  );

  return (
    <aside className={cn("relative w-full h-full overflow-auto flex flex-col justify-start items-start", props.className)}>
      <SearchBar />
      <div className="mt-2 w-full space-y-1">
        {navLinks.map((navLink) => (
          <NavLink
            key={navLink.id}
            className={({ isActive }) =>
              cn(
                "w-full px-2 rounded-xl border flex flex-row items-center text-sm text-zinc-600 dark:text-gray-400 hover:bg-white hover:border-gray-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
                isActive ? "bg-white drop-shadow-sm dark:bg-zinc-800 border-gray-200 dark:border-zinc-700" : "border-transparent",
              )
            }
            to={navLink.path}
            viewTransition
          >
            {navLink.icon}
            <span className="ml-2 truncate leading-8">{navLink.title}</span>
          </NavLink>
        ))}
      </div>
      <MemoFilters />
      <div className="px-2 w-full">
        <StatisticsView />
        {currentUser && <ShortcutsSection />}
        <TagsSection />
      </div>
    </aside>
  );
});

export default HomeSidebar;
