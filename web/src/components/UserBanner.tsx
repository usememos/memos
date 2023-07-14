import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useGlobalStore, useUserStore } from "@/store/module";
import Dropdown from "./kit/Dropdown";
import Icon from "./Icon";
import UserAvatar from "./UserAvatar";
import showAboutSiteDialog from "./AboutSiteDialog";

const UserBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { systemStatus } = globalStore.state;
  const { user } = userStore.state;
  const [username, setUsername] = useState("Memos");

  useEffect(() => {
    if (user) {
      setUsername(user.nickname || user.username);
    }
  }, [user]);

  const handleMyAccountClick = () => {
    navigate("/setting");
  };

  const handleAboutBtnClick = () => {
    showAboutSiteDialog();
  };

  const handleSignOutBtnClick = async () => {
    await userStore.doSignOut();
    window.location.href = "/auth";
  };

  return (
    <div className="flex flex-row justify-between items-center relative w-full h-auto px-2 flex-nowrap shrink-0">
      <Dropdown
        className="w-full"
        trigger={
          <div className="px-4 py-2 max-w-full flex flex-row justify-start items-center cursor-pointer rounded-lg hover:shadow hover:bg-white dark:hover:bg-zinc-700">
            <UserAvatar avatarUrl={user?.avatarUrl} />
            <span className="px-1 text-lg font-medium text-slate-800 dark:text-gray-200 shrink truncate">
              {userStore.isVisitorMode() ? systemStatus.customizedProfile.name : username}
            </span>
            {user?.role === "HOST" ? (
              <span className="text-xs px-1 bg-blue-600 dark:bg-blue-800 rounded text-white dark:text-gray-200 shadow">MOD</span>
            ) : null}
          </div>
        }
        actionsClassName="min-w-[128px] max-w-full"
        positionClassName="top-full mt-2"
        actions={
          <>
            {!userStore.isVisitorMode() && (
              <>
                <button
                  className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded flex flex-row justify-start items-center dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  onClick={handleMyAccountClick}
                >
                  <Icon.User className="w-5 h-auto mr-2 opacity-80" /> {t("setting.my-account")}
                </button>
                <a
                  className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded flex flex-row justify-start items-center dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  href={`/u/${user?.id}/rss.xml`}
                  target="_blank"
                >
                  <Icon.Rss className="w-5 h-auto mr-2 opacity-80" /> RSS
                </a>
              </>
            )}
            <button
              className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded flex flex-row justify-start items-center dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
              onClick={handleAboutBtnClick}
            >
              <Icon.Info className="w-5 h-auto mr-2 opacity-80" /> {t("common.about")}
            </button>
            {!userStore.isVisitorMode() && (
              <button
                className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded flex flex-row justify-start items-center dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                onClick={handleSignOutBtnClick}
              >
                <Icon.LogOut className="w-5 h-auto mr-2 opacity-80" /> {t("common.sign-out")}
              </button>
            )}
          </>
        }
      />
    </div>
  );
};

export default UserBanner;
