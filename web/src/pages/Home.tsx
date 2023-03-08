import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useGlobalStore, useUserStore } from "../store/module";
import toastHelper from "../components/Toast";
import MemoEditor from "../components/MemoEditor";
import MemoFilter from "../components/MemoFilter";
import MemoList from "../components/MemoList";
import MobileHeader from "../components/MobileHeader";
import HomeSidebar from "../components/HomeSidebar";

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
    <div className="w-full flex flex-row justify-start items-start">
      <div className="flex-grow w-auto max-w-2xl px-4 sm:px-2 sm:pt-4">
        <MobileHeader />
        <div className="w-full h-auto flex flex-col justify-start items-start bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          {!userStore.isVisitorMode() && <MemoEditor />}
          <MemoFilter />
        </div>
        <MemoList />
      </div>
      {!userStore.isVisitorMode() && <HomeSidebar />}
    </div>
  );
}

export default Home;
