import clsx from "clsx";
import SearchBar from "@/components/SearchBar";
import TagsSection from "../HomeSidebar/TagsSection";

interface Props {
  className?: string;
}

const ExploreSidebar = (props: Props) => {
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
