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
      toastHelper.error("密码不能为空");
      return;
    }

    if (newPassword !== newPasswordAgain) {
      toastHelper.error("新密码两次输入不一致");
      setNewPasswordAgain("");
      return;
    }

    const passwordValidResult = validate(newPassword, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error("密码 " + passwordValidResult.reason);
      return;
    }

    try {
      const isValid = await userService.checkPasswordValid(oldPassword);

      if (!isValid) {
        toastHelper.error("旧密码不匹配");
        setOldPassword("");
        return;
      }

      await userService.updatePassword(newPassword);
      toastHelper.info("密码修改成功！");
      handleCloseBtnClick();
    } catch (error: any) {
      toastHelper.error(error);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">修改密码</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <label className="form-label input-form-label">
          <span className={"normal-text " + (oldPassword === "" ? "" : "not-null")}>旧密码</span>
          <input type="password" value={oldPassword} onChange={handleOldPasswordChanged} />
        </label>
        <label className="form-label input-form-label">
          <span className={"normal-text " + (newPassword === "" ? "" : "not-null")}>新密码</span>
          <input type="password" value={newPassword} onChange={handleNewPasswordChanged} />
        </label>
        <label className="form-label input-form-label">
          <span className={"normal-text " + (newPasswordAgain === "" ? "" : "not-null")}>再次输入新密码</span>
          <input type="password" value={newPasswordAgain} onChange={handleNewPasswordAgainChanged} />
        </label>
        <div className="btns-container">
          <span className="btn cancel-btn" onClick={handleCloseBtnClick}>
            取消
          </span>
          <span className="btn confirm-btn" onClick={handleSaveBtnClick}>
            保存
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
