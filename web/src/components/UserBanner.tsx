import { useNavigate } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useGlobalStore, useUserStore } from "@/store/module";
import { User_Role } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";
import showAboutSiteDialog from "./AboutSiteDialog";
import Icon from "./Icon";
import UserAvatar from "./UserAvatar";
import Dropdown from "./kit/Dropdown";

const UserBanner = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { systemStatus } = globalStore.state;
  const user = useCurrentUser();
  const title = user ? user.nickname : systemStatus.customizedProfile.name || "memos";

  const handleMyAccountClick = () => {
    navigate(`/u/${encodeURIComponent(user.username)}`);
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
        className="w-auto"
        trigger={
          <div className="px-4 py-2 max-w-full flex flex-row justify-start items-center cursor-pointer rounded-lg hover:shadow hover:bg-white dark:hover:bg-zinc-700">
            <UserAvatar className="shadow" avatarUrl={user?.avatarUrl} />
            <span className="px-1 text-lg font-medium text-slate-800 dark:text-gray-200 shrink truncate">{title}</span>
            {user?.role === User_Role.HOST ? (
              <span className="text-xs px-1 bg-blue-600 dark:bg-blue-800 rounded text-white dark:text-gray-200 shadow">MOD</span>
            ) : null}
          </div>
        }
        actionsClassName="min-w-[128px] max-w-full"
        positionClassName="top-full mt-2"
        actions={
          <>
            {user != undefined && (
              <>
                <button
                  className="w-full px-3 truncate text-left leading-10 cursor-pointer rounded flex flex-row justify-start items-center dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  onClick={handleMyAccountClick}
                >
                  <Icon.User className="w-5 h-auto mr-2 opacity-80" /> {t("common.profile")}
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
            {user != undefined && (
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
