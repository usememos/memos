import clsx from "clsx";
import { useLocation } from "react-router-dom";
import useDebounce from "react-use/lib/useDebounce";
import SearchBar from "@/components/SearchBar";
import { useMemoList, useMemoMetadataStore } from "@/store/v1";
import TagsSection from "../HomeSidebar/TagsSection";
import useCurrentNest from "@/hooks/useCurrentNest";

interface Props {
  className?: string;
}

const ExploreSidebar = (props: Props) => {
  const location = useLocation();
  const memoList = useMemoList();
  const memoMetadataStore = useMemoMetadataStore();
  const nest = useCurrentNest();

  useDebounce(
    async () => {
      if (memoList.size() === 0) return;
      await memoMetadataStore.fetchMemoMetadata({ location, nest });
    },
    300,
    [memoList.size(), location.pathname, nest],
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
