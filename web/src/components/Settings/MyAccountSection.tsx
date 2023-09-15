import { Button } from "@mui/joy";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";
import showChangePasswordDialog from "../ChangePasswordDialog";
import showUpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import AccessTokenSection from "./AccessTokenSection";

const MyAccountSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();

  return (
    <>
      <div className="section-container account-section-container">
        <p className="text-sm mt-4 first:mt-2 mb-3 font-mono text-gray-500 dark:text-gray-400">{t("setting.account-section.title")}</p>
        <div className="flex flex-row justify-start items-center">
          <UserAvatar className="mr-2" avatarUrl={user.avatarUrl} />
          <span className="text-2xl leading-10 font-medium">{user.nickname}</span>
          <span className="text-base ml-1 text-gray-500 leading-10 dark:text-gray-400">({user.username})</span>
        </div>
        <div className="flex flex-row justify-start items-center text-base text-gray-600 dark:text-gray-400">{user.email}</div>
        <div className="w-full flex flex-row justify-start items-center mt-2 space-x-2">
          <Button variant="outlined" onClick={showUpdateAccountDialog}>
            {t("common.edit")}
          </Button>
          <Button variant="outlined" onClick={showChangePasswordDialog}>
            {t("setting.account-section.change-password")}
          </Button>
        </div>

        <AccessTokenSection />
      </div>
    </>
  );
};

export default MyAccountSection;
