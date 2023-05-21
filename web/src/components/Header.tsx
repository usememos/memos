import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLayoutStore, useUserStore } from "@/store/module";
import { resolution } from "@/utils/layout";
import Icon from "./Icon";
import showSettingDialog from "./SettingDialog";
import showAskAIDialog from "./AskAIDialog";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import showAboutSiteDialog from "./AboutSiteDialog";
import UserBanner from "./UserBanner";

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const userStore = useUserStore();
  const layoutStore = useLayoutStore();
  const showHeader = layoutStore.state.showHeader;
  const isVisitorMode = userStore.isVisitorMode() && !userStore.state.user;

  useEffect(() => {
    const handleWindowResize = () => {
      if (window.innerWidth < resolution.sm) {
        layoutStore.setHeaderStatus(false);
      } else {
        layoutStore.setHeaderStatus(true);
      }
    };
    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();
  }, [location]);

  return (
    <div
      className={`fixed sm:sticky top-0 left-0 w-full sm:w-56 h-full shrink-0 pointer-events-none sm:pointer-events-auto z-10 ${
        showHeader && "pointer-events-auto"
      }`}
    >
      <div
        className={`fixed top-0 left-0 w-full h-full bg-black opacity-0 pointer-events-none transition-opacity duration-300 sm:!hidden ${
          showHeader && "opacity-60 pointer-events-auto"
        }`}
        onClick={() => layoutStore.setHeaderStatus(false)}
      ></div>
      <header
        className={`relative w-56 sm:w-full h-full max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start py-4 z-30 bg-zinc-100 dark:bg-zinc-800 sm:bg-transparent sm:shadow-none transition-all duration-300 -translate-x-full sm:translate-x-0 ${
          showHeader && "translate-x-0 shadow-2xl"
        }`}
      >
        <UserBanner />
        <div className="w-full px-2 py-2 flex flex-col justify-start items-start shrink-0 space-y-2">
          {!isVisitorMode && (
            <>
              <NavLink
                to="/"
                id="header-home"
                className={({ isActive }) =>
                  `${
                    isActive && "bg-white dark:bg-zinc-700 shadow"
                  } px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700`
                }
              >
                <>
                  <Icon.Home className="mr-3 w-6 h-auto opacity-70" /> {t("common.home")}
                </>
              </NavLink>
              <NavLink
                to="/review"
                id="header-review"
                className={({ isActive }) =>
                  `${
                    isActive && "bg-white dark:bg-zinc-700 shadow"
                  } px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700`
                }
              >
                <>
                  <Icon.Calendar className="mr-3 w-6 h-auto opacity-70" /> {t("daily-review.title")}
                </>
              </NavLink>
              <NavLink
                to="/resources"
                id="header-resources"
                className={({ isActive }) =>
                  `${
                    isActive && "bg-white dark:bg-zinc-700 shadow"
                  } px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700`
                }
              >
                <>
                  <Icon.Paperclip className="mr-3 w-6 h-auto opacity-70" /> {t("common.resources")}
                </>
              </NavLink>
            </>
          )}
          <NavLink
            to="/explore"
            id="header-explore"
            className={({ isActive }) =>
              `${
                isActive && "bg-white dark:bg-zinc-700 shadow"
              } px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700`
            }
          >
            <>
              <Icon.Hash className="mr-3 w-6 h-auto opacity-70" /> {t("common.explore")}
            </>
          </NavLink>
          {!isVisitorMode && (
            <>
              <button
                id="header-ask-ai"
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showAskAIDialog()}
              >
                <Icon.Bot className="mr-3 w-6 h-auto opacity-70" /> {t("ask-ai.title")}
              </button>
              <button
                id="header-archived-memo"
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showArchivedMemoDialog()}
              >
                <Icon.Archive className="mr-3 w-6 h-auto opacity-70" /> {t("common.archived")}
              </button>
              <button
                id="header-settings"
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showSettingDialog()}
              >
                <Icon.Settings className="mr-3 w-6 h-auto opacity-70" /> {t("common.settings")}
              </button>
            </>
          )}
          {isVisitorMode && (
            <>
              <NavLink
                to="/auth"
                id="header-auth"
                className={({ isActive }) =>
                  `${
                    isActive && "bg-white dark:bg-zinc-700 shadow"
                  } px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700`
                }
              >
                <>
                  <Icon.LogIn className="mr-3 w-6 h-auto opacity-70" /> {t("common.sign-in")}
                </>
              </NavLink>
              <button
                id="header-about"
                className="px-4 pr-5 py-2 rounded-lg flex flex-row items-center text-lg text-gray-800 dark:text-gray-300 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={() => showAboutSiteDialog()}
              >
                <Icon.CupSoda className="mr-3 w-6 h-auto opacity-70" /> {t("common.about")}
              </button>
            </>
          )}
        </div>
      </header>
    </div>
  );
};

export default Header;
