import { Button } from "@mui/joy";
import { memoServiceClient } from "@/grpcweb";
import { downloadFileFromUrl } from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";
import showChangePasswordDialog from "../ChangePasswordDialog";
import showUpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";
import AccessTokenSection from "./AccessTokenSection";

const MyAccountSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();

  const downloadExportedMemos = async (user: any) => {
    const { content } = await memoServiceClient.exportMemos({ filter: `creator == "${user.name}"` });
    const downloadUrl = window.URL.createObjectURL(new Blob([content]));
    downloadFileFromUrl(downloadUrl, "memos-export.zip");
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="w-full gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("setting.account-section.title")}</p>
      <div className="w-full mt-2 flex flex-row justify-start items-center">
        <UserAvatar className="mr-2 shrink-0 w-10 h-10" avatarUrl={user.avatarUrl} />
        <div className="max-w-[calc(100%-3rem)] flex flex-col justify-center items-start">
          <p className="w-full">
            <span className="text-xl leading-tight font-medium">{user.nickname}</span>
            <span className="ml-1 text-base leading-tight text-gray-500 dark:text-gray-400">({user.username})</span>
          </p>
          <p className="w-4/5 leading-tight text-sm truncate">{user.description}</p>
        </div>
      </div>
      <div className="w-full flex flex-row justify-start items-center mt-2 space-x-2">
        <Button variant="outlined" onClick={showUpdateAccountDialog}>
          {t("common.edit")}
        </Button>
        <Button variant="outlined" onClick={showChangePasswordDialog}>
          {t("setting.account-section.change-password")}
        </Button>
        <Button variant="outlined" onClick={() => downloadExportedMemos(user)}>
          {t("setting.account-section.export-memos")}
        </Button>
      </div>

      <AccessTokenSection />
    </div>
  );
};

export default MyAccountSection;
