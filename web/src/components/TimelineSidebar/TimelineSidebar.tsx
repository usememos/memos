import clsx from "clsx";
import useCurrentUser from "@/hooks/useCurrentUser";
import TagsSection from "../HomeSidebar/TagsSection";
import SearchBar from "../SearchBar";
import UserStatisticsView from "../UserStatisticsView";

interface Props {
  className?: string;
}

const TimelineSidebar = (props: Props) => {
  const currentUser = useCurrentUser();

  return (
    <aside
      className={clsx(
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

export default TimelineSidebar;
