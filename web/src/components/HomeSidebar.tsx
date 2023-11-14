import SearchBar from "./SearchBar";
import TagList from "./TagList";
import UsageHeatMap from "./UsageHeatMap";

const HomeSidebar = () => {
  return (
    <aside className="relative w-full pr-2 h-full max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start py-4">
      <div className="px-4 pr-8 mb-4 w-full">
        <SearchBar />
      </div>
      <UsageHeatMap />
      <TagList />
    </aside>
  );
};

export default HomeSidebar;
