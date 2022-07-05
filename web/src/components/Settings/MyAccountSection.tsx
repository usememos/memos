import { useState } from "react";
import { useAppSelector } from "../../store";
import { userService } from "../../services";
import { validate, ValidatorConfig } from "../../helpers/validator";
import toastHelper from "../Toast";
import showChangePasswordDialog from "../ChangePasswordDialog";
import showConfirmResetOpenIdDialog from "../ConfirmResetOpenIdDialog";
import "../../less/settings/my-account-section.less";

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 24,
  noSpace: true,
  noChinese: true,
};

interface Props {}

const MyAccountSection: React.FC<Props> = () => {
  const user = useAppSelector((state) => state.user.user as User);
  const [username, setUsername] = useState<string>(user.name);
  const openAPIRoute = `${window.location.origin}/api/memo?openId=${user.openId}`;

  const handleUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUsername = e.target.value as string;
    setUsername(nextUsername);
  };

  const handleConfirmEditUsernameBtnClick = async () => {
    if (username === user.name) {
      return;
    }

    const usernameValidResult = validate(username, validateConfig);
    if (!usernameValidResult.result) {
      toastHelper.error("Username " + usernameValidResult.reason);
      return;
    }

    try {
      await userService.patchUser({
        name: username,
      });
      toastHelper.info("Username changed");
    } catch (error: any) {
      toastHelper.error(error.message);
    }
  };

  const handleChangePasswordBtnClick = () => {
    showChangePasswordDialog();
  };

  const handleResetOpenIdBtnClick = async () => {
    showConfirmResetOpenIdDialog();
  };

  const handlePreventDefault = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <div className="section-container account-section-container">
        <p className="title-text">Account Information</p>
        <label className="form-label">
          <span className="normal-text">Email:</span>
          <span className="normal-text">{user.email}</span>
        </label>
        <label className="form-label input-form-label username-label">
          <span className="normal-text">Username:</span>
          <input type="text" value={username} onChange={handleUsernameChanged} />
          <div className={`btns-container ${username === user.name ? "!hidden" : ""}`} onClick={handlePreventDefault}>
            <span className="btn confirm-btn" onClick={handleConfirmEditUsernameBtnClick}>
              Save
            </span>
            <span
              className="btn cancel-btn"
              onClick={() => {
                setUsername(user.name);
              }}
            >
              Cancel
            </span>
          </div>
        </label>
        <label className="form-label password-label">
          <span className="normal-text">Password:</span>
          <span className="btn" onClick={handleChangePasswordBtnClick}>
            Change it
          </span>
        </label>
      </div>
      <div className="section-container openapi-section-container">
        <p className="title-text">Open API</p>
        <p className="value-text">{openAPIRoute}</p>
        <span className="reset-btn" onClick={handleResetOpenIdBtnClick}>
          Reset API
        </span>
        <div className="usage-guide-container">
          <p className="title-text">Usage guide:</p>
          <pre>{`POST ${openAPIRoute}\nContent-type: application/json\n{\n  "content": "Hello #memos from ${window.location.origin}"\n}`}</pre>
        </div>
      </div>
    </>
  );
};

export default MyAccountSection;
