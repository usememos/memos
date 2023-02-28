import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoStore, useTagStore, useUserStore } from "../store/module";
import { getMemoStats } from "../helpers/api";
import * as utils from "../helpers/utils";
import Dropdown from "./common/Dropdown";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import showAboutSiteDialog from "./AboutSiteDialog";
import UserAvatar from "./UserAvatar";
import showSettingDialog from "./SettingDialog";

const UserBanner = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const memoStore = useMemoStore();
  const tagStore = useTagStore();
  const { user, owner } = userStore.state;
  const { memos } = memoStore.state;
  const tags = tagStore.state.tags;
  const [username, setUsername] = useState("Memos");
  const [memoAmount, setMemoAmount] = useState(0);
  const [createdDays, setCreatedDays] = useState(0);
  const isVisitorMode = userStore.isVisitorMode();

  useEffect(() => {
    if (isVisitorMode) {
      if (!owner) {
        return;
      }
      setUsername(owner.nickname || owner.username);
      setCreatedDays(Math.ceil((Date.now() - utils.getTimeStampByDate(owner.createdTs)) / 1000 / 3600 / 24));
    } else if (user) {
      setUsername(user.nickname || user.username);
      setCreatedDays(Math.ceil((Date.now() - utils.getTimeStampByDate(user.createdTs)) / 1000 / 3600 / 24));
    }
  }, [isVisitorMode, user, owner]);

  useEffect(() => {
    getMemoStats(userStore.getCurrentUserId())
      .then(({ data: { data } }) => {
        setMemoAmount(data.length);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [memos]);

  const handleMyAccountClick = () => {
    showSettingDialog("my-account");
  };

  const handleArchivedBtnClick = () => {
    showArchivedMemoDialog();
  };

  const handleAboutBtnClick = () => {
    showAboutSiteDialog();
  };

  const handleSignOutBtnClick = async () => {
    await userStore.doSignOut();
    window.location.href = "/auth";
  };

  return (
    <>
      <div className="flex flex-row justify-between items-center relative w-full h-auto px-3 flex-nowrap shrink-0">
        <Dropdown
          className="w-full"
          trigger={
            <div className="px-2 py-1 max-w-full flex flex-row justify-start items-center cursor-pointer rounded hover:shadow hover:bg-white dark:hover:bg-zinc-700">
              <UserAvatar avatarUrl={user?.avatarUrl} />
              <span className="px-1 text-lg font-medium text-slate-800 dark:text-gray-200 shrink truncate">{username}</span>
              {!isVisitorMode && user?.role === "HOST" ? (
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
                    className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    onClick={handleMyAccountClick}
                  >
                    <span className="mr-1">🤠</span> {t("setting.my-account")}
                  </button>
                  <button
                    className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    onClick={handleArchivedBtnClick}
                  >
                    <span className="mr-1">🗃️</span> {t("sidebar.archived")}
                  </button>
                </>
              )}
              <button
                className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                onClick={handleAboutBtnClick}
              >
                <span className="mr-1">🏂</span> {t("common.about")}
              </button>
              {!userStore.isVisitorMode() && (
                <button
                  className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  onClick={handleSignOutBtnClick}
                >
                  <span className="mr-1">👋</span> {t("common.sign-out")}
                </button>
              )}
            </>
          }
        />
      </div>
      <div className="flex flex-row justify-between items-start w-full px-6 select-none shrink-0 pb-2">
        <div className="flex flex-col justify-start items-start">
          <span className="font-bold text-2xl opacity-80 leading-10 text-slate-600 dark:text-gray-300">{memoAmount}</span>
          <span className="text-gray-400 text-xs font-mono">{t("amount-text.memo", { count: memoAmount })}</span>
        </div>
        <div className="flex flex-col justify-start items-start">
          <span className="font-bold text-2xl opacity-80 leading-10 text-slate-600 dark:text-gray-300">{tags.length}</span>
          <span className="text-gray-400 text-xs font-mono">{t("amount-text.tag", { count: tags.length })}</span>
        </div>
        <div className="flex flex-col justify-start items-start">
          <span className="font-bold text-2xl opacity-80 leading-10 text-slate-600 dark:text-gray-300">{createdDays}</span>
          <span className="text-gray-400 text-xs font-mono">{t("amount-text.day", { count: createdDays })}</span>
        </div>
      </div>
    </>
  );
};

export default UserBanner;
