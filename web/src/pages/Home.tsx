import { useEffect } from "react";
import { locationService, userService } from "../services";
import { useAppSelector } from "../store";
import useLoading from "../hooks/useLoading";
import Only from "../components/common/OnlyWhen";
import Sidebar from "../components/Sidebar";
import MemosHeader from "../components/MemosHeader";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import toastHelper from "../components/Toast";
import "../less/home.less";

function Home() {
  const location = useAppSelector((state) => state.location);
  const loadingState = useLoading();

  useEffect(() => {
    userService
      .initialState()
      .catch()
      .finally(async () => {
        const { host, owner, user } = userService.getState();
        if (!host) {
          locationService.replaceHistory("/signin");
          return;
        }

        if (userService.isVisitorMode()) {
          if (!owner) {
            toastHelper.error("User not found");
          }
        } else {
          if (!user) {
            locationService.replaceHistory(`/u/${host.id}`);
          }
        }
        loadingState.setFinish();
      });
  }, [location]);

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
