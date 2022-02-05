import { useEffect, useState } from "react";
import { validate, ValidatorConfig } from "../helpers/validator";
import { userService } from "../services";
import { showDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/change-password-dialog.less";

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 24,
  noSpace: true,
  noChinese: true,
};

interface Props extends DialogProps {}

const ChangePasswordDialog: React.FC<Props> = ({ destroy }: Props) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleOldPasswordChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setOldPassword(text);
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
    if (oldPassword === "" || newPassword === "" || newPasswordAgain === "") {
      toastHelper.error("Please fill in all fields.");
      return;
    }

    if (newPassword !== newPasswordAgain) {
      toastHelper.error("New passwords do not match.");
      setNewPasswordAgain("");
      return;
    }

    const passwordValidResult = validate(newPassword, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error("Password " + passwordValidResult.reason);
      return;
    }

    try {
      const isValid = await userService.checkPasswordValid(oldPassword);

      if (!isValid) {
        toastHelper.error("Old password is invalid.");
        setOldPassword("");
        return;
      }

      await userService.updatePassword(newPassword);
      toastHelper.info("Password changed.");
      handleCloseBtnClick();
    } catch (error: any) {
      toastHelper.error(error);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Change Password</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <label className="form-label input-form-label">
          <span className={"normal-text " + (oldPassword === "" ? "" : "not-null")}>Old password</span>
          <input type="password" value={oldPassword} onChange={handleOldPasswordChanged} />
        </label>
        <label className="form-label input-form-label">
          <span className={"normal-text " + (newPassword === "" ? "" : "not-null")}>New passworld</span>
          <input type="password" value={newPassword} onChange={handleNewPasswordChanged} />
        </label>
        <label className="form-label input-form-label">
          <span className={"normal-text " + (newPasswordAgain === "" ? "" : "not-null")}>New password again</span>
          <input type="password" value={newPasswordAgain} onChange={handleNewPasswordAgainChanged} />
        </label>
        <div className="btns-container">
          <span className="btn cancel-btn" onClick={handleCloseBtnClick}>
            Cancel
          </span>
          <span className="btn confirm-btn" onClick={handleSaveBtnClick}>
            Save
          </span>
        </div>
      </div>
    </>
  );
};

function showChangePasswordDialog() {
  showDialog(
    {
      className: "change-password-dialog",
    },
    ChangePasswordDialog
  );
}

export default showChangePasswordDialog;
