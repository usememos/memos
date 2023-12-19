import HomeSidebar from "@/components/HomeSidebar";
import HomeSidebarDrawer from "@/components/HomeSidebarDrawer";
import MemoEditor from "@/components/MemoEditor";
import MemoList from "@/components/MemoList";
import MobileHeader from "@/components/MobileHeader";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";

const Home = () => {
  const { md } = useResponsiveWidth();

  return (
    <div className="w-full max-w-5xl flex flex-row justify-center items-start">
      <div className="w-full sm:pt-6">
        <MobileHeader>{!md && <HomeSidebarDrawer />}</MobileHeader>
        <div className="w-full px-4 sm:px-6 md:pr-2">
          <MemoEditor className="mb-2" cacheKey="home-memo-editor" />
          <MemoList />
        </div>
      </div>
      {md && (
        <div className="hidden md:block sticky top-0 left-0 shrink-0 w-56">
          <HomeSidebar />
        </div>
      )}
    </div>
  );
};

export default Home;
