import { useContext, useState } from "react";
import appContext from "../stores/appContext";
import { userService } from "../services";
import utils from "../helpers/utils";
import { validate, ValidatorConfig } from "../helpers/validator";
import toastHelper from "./Toast";
import showChangePasswordDialog from "./ChangePasswordDialog";
import showConfirmResetOpenIdDialog from "./ConfirmResetOpenIdDialog";
import "../less/my-account-section.less";

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 24,
  noSpace: true,
  noChinese: true,
};

interface Props {}

const MyAccountSection: React.FC<Props> = () => {
  const { userState } = useContext(appContext);
  const user = userState.user as Model.User;
  const [username, setUsername] = useState<string>(user.name);
  const openAPIRoute = `${window.location.origin}/h/${user.openId}/memo`;

  const handleUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUsername = e.target.value as string;
    setUsername(nextUsername);
  };

  const handleConfirmEditUsernameBtnClick = async () => {
    if (user.name === "guest") {
      toastHelper.info("Do not change my username");
      return;
    }

    if (username === user.name) {
      return;
    }

    const usernameValidResult = validate(username, validateConfig);
    if (!usernameValidResult.result) {
      toastHelper.error("Username " + usernameValidResult.reason);
      return;
    }

    try {
      const isUsable = await userService.checkUsernameUsable(username);

      if (!isUsable) {
        toastHelper.error("Username is not available");
        return;
      }

      await userService.updateUsername(username);
      await userService.doSignIn();
      toastHelper.info("Username changed");
    } catch (error: any) {
      toastHelper.error(error.message);
    }
  };

  const handleChangePasswordBtnClick = () => {
    if (user.name === "guest") {
      toastHelper.info("Do not change my password");
      return;
    }

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
          <span className="normal-text">ID:</span>
          <span className="normal-text">{user.id}</span>
        </label>
        <label className="form-label">
          <span className="normal-text">Created at:</span>
          <span className="normal-text">{utils.getDateString(user.createdAt)}</span>
        </label>
        <label className="form-label input-form-label username-label">
          <span className="normal-text">Username:</span>
          <input type="text" value={username} onChange={handleUsernameChanged} />
          <div className={`btns-container ${username === user.name ? "hidden" : ""}`} onClick={handlePreventDefault}>
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
            Change It
          </span>
        </label>
      </div>
      <div className="section-container openapi-section-container">
        <p className="title-text">Open API (Experimental feature)</p>
        <p className="value-text">{openAPIRoute}</p>
        <span className="reset-btn" onClick={handleResetOpenIdBtnClick}>
          Reset API
        </span>
        <div className="usage-guide-container">
          <p className="title-text">Usage guide:</p>
          <pre>{`POST ${openAPIRoute}\nContent-type: application/json\n{\n  "content": "Hello, #memos ${window.location.origin}"\n}`}</pre>
        </div>
      </div>
    </>
  );
};

export default MyAccountSection;
