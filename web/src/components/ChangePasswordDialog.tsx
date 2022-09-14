import { useEffect, useState } from "react";
import { validate, ValidatorConfig } from "../helpers/validator";
import useI18n from "../hooks/useI18n";
import { userService } from "../services";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/change-password-dialog.less";

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 24,
  noSpace: true,
  noChinese: true,
};

type Props = DialogProps;

const ChangePasswordDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t, locale } = useI18n();
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
      toastHelper.error(t("common.fill-all"));
      return;
    }

    if (newPassword !== newPasswordAgain) {
      toastHelper.error(t("common.new-password-not-match"));
      setNewPasswordAgain("");
      return;
    }

    const passwordValidResult = validate(newPassword, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error(t("common.password") + locale === "zh" ? "" : " " + passwordValidResult.reason);
      return;
    }

    try {
      const user = userService.getState().user as User;
      await userService.patchUser({
        id: user.id,
        password: newPassword,
      });
      toastHelper.info(t("common.password") + t("common.changed"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("common.password" + " " + t("common.change"))}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <label className="form-label input-form-label">
          <input type="password" placeholder={t("common.new-password")} value={newPassword} onChange={handleNewPasswordChanged} />
        </label>
        <label className="form-label input-form-label">
          <input
            type="password"
            placeholder={t("common.repeat-new-password")}
            value={newPasswordAgain}
            onChange={handleNewPasswordAgainChanged}
          />
        </label>
        <div className="btns-container">
          <span className="btn cancel-btn" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </span>
          <span className="btn confirm-btn" onClick={handleSaveBtnClick}>
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
