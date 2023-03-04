import { isUndefined } from "lodash-es";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocationStore, useUserStore } from "../store/module";
import Icon from "./Icon";
import showDailyReviewDialog from "./DailyReviewDialog";
import showResourcesDialog from "./ResourcesDialog";
import showSettingDialog from "./SettingDialog";
import showAskAIDialog from "./AskAIDialog";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import UserBanner from "./UserBanner";
import "../less/header.less";

const Header = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const locationStore = useLocationStore();
  const query = locationStore.state.query;

  useEffect(() => {
    toggleHeader(false);
  }, [query]);

  return (
    <>
      <div className="mask" onClick={() => toggleHeader(false)}></div>
      <header className="header-wrapper">
        <UserBanner />
        <div className="w-full px-2 my-2 mt-4 flex flex-col justify-start items-start shrink-0 space-y-2">
          <Link
            to="/"
            className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
          >
            <Icon.Home className="mr-4 w-6 h-auto opacity-80" /> {t("common.home")}
          </Link>
          <button
            className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
            onClick={() => showDailyReviewDialog()}
          >
            <Icon.Calendar className="mr-4 w-6 h-auto opacity-80" /> {t("common.daily-review")}
          </button>
          <Link
            to="/explore"
            className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
          >
            <Icon.Hash className="mr-4 w-6 h-auto opacity-80" /> {t("common.explore")}
          </Link>
          {!userStore.isVisitorMode() && (
            <>
              <button
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showAskAIDialog()}
              >
                <Icon.Bot className="mr-4 w-6 h-auto opacity-80" /> Ask AI
              </button>
              <button
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showResourcesDialog()}
              >
                <Icon.Paperclip className="mr-4 w-6 h-auto opacity-80" /> {t("common.resources")}
              </button>
              <button
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showArchivedMemoDialog()}
              >
                <Icon.Archive className="mr-4 w-6 h-auto opacity-80" /> {t("common.archive")}
              </button>
              <button
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showSettingDialog()}
              >
                <Icon.Settings className="mr-4 w-6 h-auto opacity-80" /> {t("common.settings")}
              </button>
            </>
          )}
        </div>
      </header>
    </>
  );
};

export const toggleHeader = (show?: boolean) => {
  const headerEl = document.body.querySelector(".header-wrapper") as HTMLDivElement;
  const maskEl = headerEl.previousSibling as HTMLDivElement;

  if (isUndefined(show)) {
    show = !headerEl.classList.contains("show");
  }

  if (show) {
    headerEl.classList.add("show");
    maskEl.classList.add("show");
  } else {
    headerEl.classList.remove("show");
    maskEl.classList.remove("show");
  }
};

export default Header;
