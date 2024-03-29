import classNames from "classnames";
import SearchBar from "@/components/SearchBar";
import UsersSection from "./UsersSection";

interface Props {
  className?: string;
}

const ExploreSidebar = (props: Props) => {
  return (
    <aside
      className={classNames(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        props.className,
      )}
    >
      <SearchBar />
      <UsersSection />
    </aside>
  );
};

export default ExploreSidebar;
