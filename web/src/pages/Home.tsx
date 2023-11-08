import HomeSidebar from "@/components/HomeSidebar";
import MemoEditor from "@/components/MemoEditor";
import MemoList from "@/components/MemoList";
import MobileHeader from "@/components/MobileHeader";

const Home = () => {
  return (
    <div className="w-full flex flex-row justify-start items-start">
      <div className="w-full px-4 md:max-w-[calc(100%-14rem)] sm:px-2 sm:pt-4">
        <MobileHeader />
        <MemoEditor className="mb-2" cacheKey="home-memo-editor" />
        <MemoList />
      </div>
      <HomeSidebar />
    </div>
  );
};

export default Home;
