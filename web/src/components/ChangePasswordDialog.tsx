import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { validate, ValidatorConfig } from "../helpers/validator";
import { userService } from "../services";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 320,
  noSpace: true,
  noChinese: true,
};

type Props = DialogProps;

const ChangePasswordDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleNewPasswordChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setNewPassword(text);
  };

  const handleNewPasswordAgainChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setNewPasswordAgain(text);
  };

  const handleSaveBtnClick = async () => {
    if (newPassword === "" || newPasswordAgain === "") {
      toastHelper.error(t("message.fill-all"));
      return;
    }

    if (newPassword !== newPasswordAgain) {
      toastHelper.error(t("message.new-password-not-match"));
      setNewPasswordAgain("");
      return;
    }

    const passwordValidResult = validate(newPassword, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error(`${t("common.password")} ${t(passwordValidResult.reason as string)}`);
      return;
    }

    try {
      const user = userService.getState().user as User;
      await userService.patchUser({
        id: user.id,
        password: newPassword,
      });
      toastHelper.info(t("message.password-changed"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">{t("setting.account-section.change-password")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="text-sm mb-1">{t("common.new-password")}</p>
        <input
          type="password"
          className="input-text"
          placeholder={t("common.repeat-new-password")}
          value={newPassword}
          onChange={handleNewPasswordChanged}
        />
        <p className="text-sm mb-1 mt-2">{t("common.repeat-new-password")}</p>
        <input
          type="password"
          className="input-text"
          placeholder={t("common.repeat-new-password")}
          value={newPasswordAgain}
          onChange={handleNewPasswordAgainChanged}
        />
        <div className="mt-4 w-full flex flex-row justify-end items-center space-x-2">
          <span className="btn-text" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </span>
          <span className="btn-primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </span>
        </div>
      </div>
    </>
  );
};

function showChangePasswordDialog() {
  generateDialog(
    {
      className: "change-password-dialog",
    },
    ChangePasswordDialog
  );
}

export default showChangePasswordDialog;
