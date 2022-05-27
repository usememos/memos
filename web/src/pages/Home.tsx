import { useEffect } from "react";
import { locationService, userService } from "../services";
import Sidebar from "../components/Sidebar";
import useLoading from "../hooks/useLoading";
import MemosHeader from "../components/MemosHeader";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import "../less/home.less";

function Home() {
  const loadingState = useLoading();

  useEffect(() => {
    const { user } = userService.getState();
    if (!user) {
      userService
        .doSignIn()
        .catch(() => {
          // do nth
        })
        .finally(() => {
          if (userService.getState().user) {
            loadingState.setFinish();
          } else {
            locationService.replaceHistory("/signin");
          }
        });
    } else {
      loadingState.setFinish();
    }
  }, []);

  return (
    <>
      {loadingState.isLoading ? null : (
        <section id="page-wrapper">
          <Sidebar />
          <main className="memos-wrapper">
            <MemosHeader />
            <MemoEditor />
            <MemoFilter />
            <MemoList />
          </main>
        </section>
      )}
    </>
  );
}

export default Home;
