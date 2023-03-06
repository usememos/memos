import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useGlobalStore, useUserStore } from "../store/module";
import toastHelper from "../components/Toast";
import Header from "../components/Header";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import UpdateVersionBanner from "../components/UpdateVersionBanner";
import MobileHeader from "../components/MobileHeader";
import HomeSidebar from "../components/HomeSidebar";
import "../less/home.less";

function Home() {
  const { t } = useTranslation();
  const location = useLocation();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const user = userStore.state.user;

  useEffect(() => {
    const { owner } = userStore.getState();

    if (userStore.isVisitorMode()) {
      if (!owner) {
        toastHelper.error(t("message.user-not-found"));
      }
    }
  }, [location]);

  useEffect(() => {
    if (user?.setting.locale) {
      globalStore.setLocale(user.setting.locale);
    }
  }, [user?.setting.locale]);

  return (
    <section className="page-wrapper home">
      <div className="banner-wrapper">
        <UpdateVersionBanner />
      </div>
      <div className="page-container">
        <Header />
        <main className="memos-wrapper">
          <MobileHeader />
          <div className="memos-editor-wrapper">
            {!userStore.isVisitorMode() && <MemoEditor />}
            <MemoFilter />
          </div>
          <MemoList />
        </main>
        {!userStore.isVisitorMode() && <HomeSidebar />}
      </div>
    </section>
  );
}

export default Home;
