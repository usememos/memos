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
        <p className="font-medium my-2 text-gray-700 dark:text-gray-400">{t("setting.account-section.title")}</p>
        <div className="flex flex-row justify-start items-center">
          <UserAvatar className="mr-2 w-14 h-14" avatarUrl={user.avatarUrl} />
          <div className="flex flex-col justify-center items-start">
            <span className="text-2xl font-medium">{user.nickname}</span>
            <span className="-mt-2 text-base text-gray-500 dark:text-gray-400">({user.username})</span>
          </div>
        </div>
        <div className="w-full flex flex-row justify-start items-center mt-4 space-x-2">
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
