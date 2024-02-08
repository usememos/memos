import classNames from "classnames";
import SearchBar from "./SearchBar";
import TagList from "./TagList";

interface Props {
  className?: string;
}

const TimelineSidebar = (props: Props) => {
  return (
    <aside
      className={classNames(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        props.className,
      )}
    >
      <SearchBar />
      <TagList />
    </aside>
  );
};

export default TimelineSidebar;
