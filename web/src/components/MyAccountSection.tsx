import { useContext, useState } from "react";
import appContext from "../stores/appContext";
import { userService } from "../services";
import utils from "../helpers/utils";
import { validate, ValidatorConfig } from "../helpers/validator";
import Only from "./common/OnlyWhen";
import toastHelper from "./Toast";
import showChangePasswordDialog from "./ChangePasswordDialog";
import showBindWxOpenIdDialog from "./BindWxOpenIdDialog";
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
  const [username, setUsername] = useState<string>(user.username);
  const [showEditUsernameInputs, setShowEditUsernameInputs] = useState(false);
  const [showConfirmUnbindGithubBtn, setShowConfirmUnbindGithubBtn] = useState(false);
  const [showConfirmUnbindWxBtn, setShowConfirmUnbindWxBtn] = useState(false);

  const handleUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUsername = e.target.value as string;
    setUsername(nextUsername);
  };

  const handleConfirmEditUsernameBtnClick = async () => {
    if (user.username === "guest") {
      toastHelper.info("🈲 不要修改我的用户名");
      return;
    }

    if (username === user.username) {
      setShowEditUsernameInputs(false);
      return;
    }

    const usernameValidResult = validate(username, validateConfig);
    if (!usernameValidResult.result) {
      toastHelper.error("用户名 " + usernameValidResult.reason);
      return;
    }

    try {
      const isUsable = await userService.checkUsernameUsable(username);

      if (!isUsable) {
        toastHelper.error("用户名无法使用");
        return;
      }

      await userService.updateUsername(username);
      await userService.doSignIn();
      setShowEditUsernameInputs(false);
      toastHelper.info("修改成功~");
    } catch (error: any) {
      toastHelper.error(error.message);
    }
  };

  const handleChangePasswordBtnClick = () => {
    if (user.username === "guest") {
      toastHelper.info("🈲 不要修改我的密码");
      return;
    }

    showChangePasswordDialog();
  };

  const handleUnbindGithubBtnClick = async () => {
    if (showConfirmUnbindGithubBtn) {
      try {
        await userService.removeGithubName();
        await userService.doSignIn();
      } catch (error: any) {
        toastHelper.error(error.message);
      }
      setShowConfirmUnbindGithubBtn(false);
    } else {
      setShowConfirmUnbindGithubBtn(true);
    }
  };

  const handleUnbindWxBtnClick = async () => {
    if (showConfirmUnbindWxBtn) {
      try {
        await userService.updateWxOpenId("");
        await userService.doSignIn();
      } catch (error: any) {
        toastHelper.error(error.message);
      }
      setShowConfirmUnbindWxBtn(false);
    } else {
      setShowConfirmUnbindWxBtn(true);
    }
  };

  const handlePreventDefault = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="section-container account-section-container">
        <p className="title-text">基本信息</p>
        <label className="form-label input-form-label">
          <span className="normal-text">ID：</span>
          <span className="normal-text">{user.id}</span>
        </label>
        <label className="form-label input-form-label">
          <span className="normal-text">创建时间：</span>
          <span className="normal-text">{utils.getDateString(user.createdAt)}</span>
        </label>
        <label className="form-label input-form-label username-label">
          <span className="normal-text">账号：</span>
          <input
            type="text"
            readOnly={!showEditUsernameInputs}
            value={username}
            onClick={() => {
              setShowEditUsernameInputs(true);
            }}
            onChange={handleUsernameChanged}
          />
          <div className="btns-container" onClick={handlePreventDefault}>
            <span className={"btn confirm-btn " + (showEditUsernameInputs ? "" : "hidden")} onClick={handleConfirmEditUsernameBtnClick}>
              保存
            </span>
            <span
              className={"btn cancel-btn " + (showEditUsernameInputs ? "" : "hidden")}
              onClick={() => {
                setUsername(user.username);
                setShowEditUsernameInputs(false);
              }}
            >
              撤销
            </span>
          </div>
        </label>
        <label className="form-label password-label">
          <span className="normal-text">密码：</span>
          <span className="btn" onClick={handleChangePasswordBtnClick}>
            修改密码
          </span>
        </label>
      </div>
      {/* Account Binding Settings: only can use for domain: memos.justsven.top */}
      <Only when={window.location.origin.includes("justsven.top")}>
        <div className="section-container connect-section-container">
          <p className="title-text">关联账号</p>
          <label className="form-label input-form-label hidden">
            <span className="normal-text">微信 OpenID：</span>
            {user.wxOpenId ? (
              <>
                <span className="value-text">************</span>
                <span
                  className={`btn-text unbind-btn ${showConfirmUnbindWxBtn ? "final-confirm" : ""}`}
                  onMouseLeave={() => setShowConfirmUnbindWxBtn(false)}
                  onClick={handleUnbindWxBtnClick}
                >
                  {showConfirmUnbindWxBtn ? "确定取消绑定！" : "取消绑定"}
                </span>
              </>
            ) : (
              <>
                <span className="value-text">空</span>
                <span
                  className="btn-text bind-btn"
                  onClick={() => {
                    showBindWxOpenIdDialog();
                  }}
                >
                  绑定 ID
                </span>
              </>
            )}
          </label>
          <label className="form-label input-form-label">
            <span className="normal-text">GitHub：</span>
            {user.githubName ? (
              <>
                <a className="value-text" href={"https://github.com/" + user.githubName}>
                  {user.githubName}
                </a>
                <span
                  className={`btn-text unbind-btn ${showConfirmUnbindGithubBtn ? "final-confirm" : ""}`}
                  onMouseLeave={() => setShowConfirmUnbindGithubBtn(false)}
                  onClick={handleUnbindGithubBtnClick}
                >
                  {showConfirmUnbindGithubBtn ? "确定取消绑定！" : "取消绑定"}
                </span>
              </>
            ) : (
              <>
                <span className="value-text">空</span>
                <a
                  className="btn-text link-btn"
                  href="https://github.com/login/oauth/authorize?client_id=187ba36888f152b06612&scope=read:user,gist"
                >
                  前往绑定
                </a>
              </>
            )}
          </label>
        </div>
      </Only>
    </>
  );
};

export default MyAccountSection;
