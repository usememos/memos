import * as api from "@/helpers/api";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useGlobalStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import showAboutSiteDialog from "./AboutSiteDialog";
import Icon from "./Icon";
import UserAvatar from "./UserAvatar";
import Dropdown from "./kit/Dropdown";

const UserBanner = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const { systemStatus } = globalStore.state;
  const user = useCurrentUser();
  const title = user ? user.nickname || user.username : systemStatus.customizedProfile.name || "memos";

  const handleAboutBtnClick = () => {
    showAboutSiteDialog();
  };

  const handleSignOutBtnClick = async () => {
    await api.signout();
    window.location.href = "/auth";
  };

  return (
    <div className="relative w-full h-auto px-1 shrink-0">
      <Dropdown
        className="w-auto inline-flex"
        trigger={
          <div className="px-3 py-2 max-w-full flex flex-row justify-start items-center cursor-pointer rounded-2xl hover:shadow hover:bg-white dark:hover:bg-zinc-700">
            <UserAvatar className="shadow shrink-0 mr-2" avatarUrl={user?.avatarUrl} />
            <span className="text-lg font-medium text-slate-800 dark:text-gray-200 shrink truncate">{title}</span>
          </div>
        }
        actionsClassName="min-w-[128px] max-w-full"
        positionClassName="top-full mt-2"
        actions={
          <>
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
