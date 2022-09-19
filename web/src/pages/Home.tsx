import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { globalService, userService } from "../services";
import { useAppSelector } from "../store";
import useI18n from "../hooks/useI18n";
import { isNullorUndefined } from "../helpers/utils";
import Only from "../components/common/OnlyWhen";
import toastHelper from "../components/Toast";
import Sidebar from "../components/Sidebar";
import MemosHeader from "../components/MemosHeader";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import "../less/home.less";

function Home() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.user.user);

  useEffect(() => {
    const { host, owner, user } = userService.getState();

    if (isNullorUndefined(host)) {
      navigate("/auth");
      return;
    }

    if (userService.isVisitorMode()) {
      if (!owner) {
        toastHelper.error(t("message.user-not-found"));
      }
    } else {
      if (isNullorUndefined(user)) {
        navigate("/explore");
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
    </section>
  );
}

export default Home;
