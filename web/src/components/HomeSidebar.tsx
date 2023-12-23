import MemoCreationHeatMap from "./MemoCreationHeatMap";
import SearchBar from "./SearchBar";
import TagList from "./TagList";

const HomeSidebar = () => {
  return (
    <aside className="relative w-full pr-2 h-full max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start py-4 sm:pt-6">
      <div className="px-4 pr-8 mb-4 w-full">
        <SearchBar />
      </div>
      <MemoCreationHeatMap />
      <TagList />
    </aside>
  );
};

export default HomeSidebar;
