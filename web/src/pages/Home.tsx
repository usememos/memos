import { useEffect } from "react";
import { locationService, userService } from "../services";
import useLoading from "../hooks/useLoading";
import Only from "../components/common/OnlyWhen";
import Sidebar from "../components/Sidebar";
import MemosHeader from "../components/MemosHeader";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import "../less/home.less";

function Home() {
  const loadingState = useLoading();

  useEffect(() => {
    userService
      .doSignIn()
      .catch()
      .finally(() => {
        if (!userService.isVisitorMode() && !userService.getState().user) {
          locationService.replaceHistory("/signin");
          return;
        }
        loadingState.setFinish();
      });
  }, []);

  return (
    <section className="page-wrapper home">
      {loadingState.isLoading ? null : (
        <div className="page-container">
          <Sidebar />
          <main className="memos-wrapper">
            <div className="memos-editor-wrapper">
              <MemosHeader />
              <Only when={!userService.isVisitorMode()}>
                <MemoEditor />
              </Only>
              <MemoFilter />
            </div>
            <MemoList />
          </main>
        </div>
      )}
    </section>
  );
}

export default Home;
