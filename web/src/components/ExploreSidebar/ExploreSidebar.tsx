import clsx from "clsx";
import { useLocation } from "react-router-dom";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import { useMemoList, useMemoMetadataStore, useMemoTagStore, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import TagsSection from "../HomeSidebar/TagsSection";

interface Props {
  className?: string;
}

const ExploreSidebar = (props: Props) => {
  const location = useLocation();
  const memoList = useMemoList();
  const memoMetadataStore = useMemoMetadataStore();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const memoTagtore = useMemoTagStore();

  useDebounce(
    async () => {
      if (memoList.size() === 0) return;
      await memoMetadataStore.fetchMemoMetadata({ location });

      if (workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.MEMO_RELATED).memoRelatedSetting?.shareTags) {
        await memoTagtore.fetchMemoTags();
      }
    },
    300,
    [memoList.size(), location.pathname],
  );

  return (
    <aside
      className={clsx(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        props.className,
      )}
    >
      <SearchBar />
      <TagsSection readonly={true} />
    </aside>
  );
};

export default ExploreSidebar;
