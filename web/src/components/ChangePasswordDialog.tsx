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
      await userService.patchUser({
        password: newPassword,
      });
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
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="dialog-content-container">
        <label className="form-label input-form-label">
          <input type="password" placeholder="New passworld" value={newPassword} onChange={handleNewPasswordChanged} />
        </label>
        <label className="form-label input-form-label">
          <input type="password" placeholder="Repeat the new password" value={newPasswordAgain} onChange={handleNewPasswordAgainChanged} />
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
