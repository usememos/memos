import useCurrentUser from "@/hooks/useCurrentUser";
import PersonalStatistics from "./PersonalStatistics";
import SearchBar from "./SearchBar";
import TagList from "./TagList";

const HomeSidebar = () => {
  const currentUser = useCurrentUser();

  return (
    <aside className="relative w-full px-4 h-full max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start py-4 sm:pt-6">
      <SearchBar />
      <PersonalStatistics user={currentUser} />
      <TagList />
    </aside>
  );
};

export default HomeSidebar;
