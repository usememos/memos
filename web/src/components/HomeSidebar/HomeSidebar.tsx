import clsx from "clsx";
import { useLocation } from "react-router-dom";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import UserStatisticsView from "@/components/UserStatisticsView";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoList, useMemoMetadataStore, useMemoTagStore, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import TagsSection from "./TagsSection";

interface Props {
  className?: string;
}

const HomeSidebar = (props: Props) => {
  const location = useLocation();
  const user = useCurrentUser();
  const memoList = useMemoList();
  const memoMetadataStore = useMemoMetadataStore();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const memoTagtore = useMemoTagStore();

  useDebounce(
    async () => {
      await memoMetadataStore.fetchMemoMetadata({ user, location });

      if (workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.MEMO_RELATED).memoRelatedSetting?.shareTags) {
        await memoTagtore.fetchMemoTags();
      }
    },
    300,
    [memoList.size(), user, location.pathname],
  );

  return (
    <aside
      className={clsx(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        props.className,
      )}
    >
      <SearchBar />
      <UserStatisticsView />
      <TagsSection />
    </aside>
  );
};

export default HomeSidebar;
