import { useTranslation } from "react-i18next";
import { useUserStore } from "../../store/module";
import { showCommonDialog } from "../Dialog/CommonDialog";
import showChangePasswordDialog from "../ChangePasswordDialog";
import showUpdateAccountDialog from "../UpdateAccountDialog";
import "../../less/settings/my-account-section.less";

const MyAccountSection = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const user = userStore.state.user as User;
  const openAPIRoute = `${window.location.origin}/api/memo?openId=${user.openId}`;

  const handleResetOpenIdBtnClick = async () => {
    showCommonDialog({
      title: "Reset Open API",
      content: "❗️The existing API will be invalidated and a new one will be generated, are you sure you want to reset?",
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

  return (
    <>
      <div className="section-container account-section-container">
        <p className="title-text">{t("setting.account-section.title")}</p>
        <div className="flex flex-row justify-start items-end">
          <span className="text-2xl leading-10 font-medium">{user.nickname}</span>
          <span className="text-base ml-1 text-gray-500 leading-8">({user.username})</span>
        </div>
        <div className="flex flex-row justify-start items-center text-base text-gray-600">{user.email}</div>
        <div className="w-full flex flex-row justify-start items-center mt-2 space-x-2">
          <button className="btn-normal" onClick={showUpdateAccountDialog}>
            {t("setting.account-section.update-information")}
          </button>
          <button className="btn-normal" onClick={showChangePasswordDialog}>
            {t("setting.account-section.change-password")}
          </button>
        </div>
      </div>
      <div className="section-container openapi-section-container">
        <p className="title-text">Open API</p>
        <p className="value-text">{openAPIRoute}</p>
        <span className="btn-danger mt-2" onClick={handleResetOpenIdBtnClick}>
          {t("common.reset")} API
        </span>
        <div className="usage-guide-container">
          <pre>{`POST ${openAPIRoute}\nContent-type: application/json\n{\n  "content": "Hello #memos from ${window.location.origin}"\n}`}</pre>
        </div>
      </div>
    </>
  );
};

export default MyAccountSection;
