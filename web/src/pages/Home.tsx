import { useEffect } from "react";
import { userService } from "../services";
import Sidebar from "../components/Sidebar";
import useLoading from "../hooks/useLoading";
import MemosHeader from "../components/MemosHeader";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import "../less/home.less";

function Home() {
  const { user } = userService.getState();
  const loadingState = useLoading();

  useEffect(() => {
    if (!user) {
      userService
        .doSignIn()
        .catch(() => {
          // do nth
        })
        .finally(() => {
          loadingState.setFinish();
        });
    } else {
      loadingState.setFinish();
    }
  }, []);

  return (
    <section className="page-wrapper home">
      {loadingState.isLoading ? null : (
        <div className="page-container">
          <Sidebar />
          <main className="memos-wrapper">
            <div className="memos-editor-wrapper">
              <MemosHeader />
              {user && <MemoEditor />}
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
