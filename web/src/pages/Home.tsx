import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { globalService, userService } from "../services";
import { useAppSelector } from "../store";
import toastHelper from "../components/Toast";
import Sidebar from "../components/Sidebar";
import MemosHeader from "../components/MemosHeader";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import UpdateVersionBanner from "../components/UpdateVersionBanner";
import "../less/home.less";

function Home() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAppSelector((state) => state.user.user);

  useEffect(() => {
    const { owner } = userService.getState();

    if (userService.isVisitorMode()) {
      if (!owner) {
        toastHelper.error(t("message.user-not-found"));
      }
    }
  }, [location]);

  useEffect(() => {
    if (user?.setting.locale) {
      globalService.setLocale(user.setting.locale);
    }
  }, [user?.setting.locale]);

  return (
    <section className="page-wrapper home">
      <div className="banner-wrapper">
        <UpdateVersionBanner />
      </div>
      <div className="page-container">
        <Sidebar />
        <main className="memos-wrapper">
          <div className="memos-editor-wrapper">
            <MemosHeader />
            {!userService.isVisitorMode() && <MemoEditor />}
            <MemoFilter />
          </div>
          <MemoList />
          {userService.isVisitorMode() && (
            <div className="addition-btn-container">
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
          )}
        </main>
      </div>
    </section>
  );
}

export default Home;
