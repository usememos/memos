import { Button, Input, Textarea } from "@mui/joy";
import { useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import showChangePasswordDialog from "../ChangePasswordDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import showUpdateAccountDialog from "../UpdateAccountDialog";
import UserAvatar from "../UserAvatar";

const MyAccountSection = () => {
  const t = useTranslate();
  const userStore = useUserStore();
  const user = userStore.state.user as User;
  const openAPIRoute = `${window.location.origin}/api/v1/memo?openId=${user.openId}`;

  const handleResetOpenIdBtnClick = async () => {
    showCommonDialog({
      title: t("setting.account-section.openapi-reset"),
      content: t("setting.account-section.openapi-reset-warning"),
      style: "warning",
      dialogName: "reset-openid-dialog",
      onConfirm: async () => {
        await userStore.patchUser({
          id: user.id,
          resetOpenId: true,
        });
      },
    });
  };

  const exampleWithCurl = `curl '${openAPIRoute}' -H 'Content-Type: application/json' --data-raw '{"content":"Hello world!"}'`;

  return (
    <>
      <div className="section-container account-section-container">
        <p className="title-text">{t("setting.account-section.title")}</p>
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
      </div>
      <div className="section-container openapi-section-container mt-6">
        <p className="title-text">Open ID</p>
        <div className="w-full flex flex-row justify-start items-center">
          <Input className="grow mr-2" value={user.openId} readOnly />
          <Button className="shrink-0" color="neutral" variant="outlined" onClick={handleResetOpenIdBtnClick}>
            <Icon.RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="title-text">Open API Example with cURL</p>
        <Textarea className="w-full !font-mono !text-sm whitespace-pre" value={exampleWithCurl} readOnly />
      </div>
    </>
  );
};

export default MyAccountSection;
