import { useEffect } from "react";
import { locationService, userService } from "../services";
import { useAppSelector } from "../store";
import useI18n from "../hooks/useI18n";
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
  const { t } = useI18n();
  const user = useAppSelector((state) => state.user.user);
  const location = useAppSelector((state) => state.location);
  const loadingState = useLoading();

  useEffect(() => {
    userService
      .initialState()
      .catch()
      .finally(async () => {
        const { host, owner, user } = userService.getState();
        if (!host) {
          locationService.replaceHistory("/auth");
          return;
        }

        if (userService.isVisitorMode()) {
          if (!owner) {
            toastHelper.error("User not found");
          }
        } else {
          if (!user) {
            locationService.replaceHistory(`/explore`);
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
            <Only when={userService.isVisitorMode()}>
              <div className="addtion-btn-container">
                {user ? (
                  <button className="btn" onClick={() => (window.location.href = "/")}>
                    <span className="icon">🏠</span> {t("common.back-to-home")}
                  </button>
                ) : (
                  <button className="btn" onClick={() => (window.location.href = "/auth")}>
                    <span className="icon">👉</span> {t("common.sign-in")}
                  </button>
                )}
              </div>
            </Only>
          </main>
        </div>
      )}
    </section>
  );
}

export default Home;
