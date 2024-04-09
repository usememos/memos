import classNames from "classnames";
import SearchBar from "@/components/SearchBar";
import UserStatisticsView from "@/components/UserStatisticsView";
import useCurrentUser from "@/hooks/useCurrentUser";
import TagsSection from "./TagsSection";

interface Props {
  className?: string;
}

const HomeSidebar = (props: Props) => {
  const currentUser = useCurrentUser();

  return (
    <aside
      className={classNames(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        props.className,
      )}
    >
      <SearchBar />
      <UserStatisticsView user={currentUser} />
      <TagsSection />
    </aside>
  );
};

export default HomeSidebar;
