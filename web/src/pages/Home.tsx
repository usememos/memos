import { useEffect } from "react";
import { locationService, userService } from "../services";
import * as api from "../helpers/api";
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
  const loadingState = useLoading();

  useEffect(() => {
    userService
      .doSignIn()
      .catch()
      .finally(async () => {
        if (!userService.getState().user) {
          if (userService.isVisitorMode()) {
            const currentUserId = userService.getUserIdFromPath() as number;
            const user = await userService.getUserById(currentUserId);
            if (!user) {
              toastHelper.error("User not found");
            }
          } else {
            locationService.replaceHistory("/signin");
            return;
          }
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
