import classNames from "classnames";
import PersonalStatistics from "@/components/PersonalStatistics";
import SearchBar from "@/components/SearchBar";
import TagList from "@/components/TagList";
import useCurrentUser from "@/hooks/useCurrentUser";

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
      <PersonalStatistics user={currentUser} />
      <TagList />
    </aside>
  );
};

export default HomeSidebar;
