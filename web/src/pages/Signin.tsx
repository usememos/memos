import { useEffect, useRef, useState } from "react";
import api from "../helpers/api";
import { validate, ValidatorConfig } from "../helpers/validator";
import useLoading from "../hooks/useLoading";
import { locationService, userService } from "../services";
import toastHelper from "../components/Toast";
import "../less/signin.less";

interface Props {}

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 24,
  noSpace: true,
  noChinese: true,
};

const Signin: React.FC<Props> = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showAutoSigninAsGuest, setShowAutoSigninAsGuest] = useState(true);
  const signinBtnsClickLoadingState = useLoading(false);
  const autoSigninAsGuestBtn = useRef<HTMLDivElement>(null);
  const signinBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        autoSigninAsGuestBtn.current?.click();
        signinBtn.current?.click();
      }
    };

    document.body.addEventListener("keypress", handleKeyPress);

    return () => {
      document.body.removeEventListener("keypress", handleKeyPress);
    };
  }, []);

  const handleUsernameInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setUsername(text);
  };

  const handlePasswordInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setPassword(text);
  };

  const handleSigninBtnsClick = async (action: "signin" | "signup" = "signin") => {
    if (signinBtnsClickLoadingState.isLoading) {
      return;
    }

    const usernameValidResult = validate(username, validateConfig);
    if (!usernameValidResult.result) {
      toastHelper.error("用户名 " + usernameValidResult.reason);
      return;
    }

    const passwordValidResult = validate(password, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error("密码 " + passwordValidResult.reason);
      return;
    }

    try {
      signinBtnsClickLoadingState.setLoading();
      let actionFunc = api.signin;
      if (action === "signup") {
        actionFunc = api.signup;
      }
      const { succeed, message } = await actionFunc(username, password);

      if (!succeed && message) {
        toastHelper.error("😟 " + message);
        return;
      }

      const user = await userService.doSignIn();
      if (user) {
        locationService.replaceHistory("/");
      } else {
        toastHelper.error("😟 登录失败");
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error("😟 " + error.message);
    }
    signinBtnsClickLoadingState.setFinish();
  };

  const handleSwitchAccountSigninBtnClick = () => {
    if (signinBtnsClickLoadingState.isLoading) {
      return;
    }

    setShowAutoSigninAsGuest(false);
  };

  const handleAutoSigninAsGuestBtnClick = async () => {
    if (signinBtnsClickLoadingState.isLoading) {
      return;
    }

    try {
      signinBtnsClickLoadingState.setLoading();
      const { succeed, message } = await api.signin("guest", "123456");

      if (!succeed && message) {
        toastHelper.error("😟 " + message);
        return;
      }

      const user = await userService.doSignIn();
      if (user) {
        locationService.replaceHistory("/");
      } else {
        toastHelper.error("😟 登录失败");
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error("😟 " + error.message);
    }
    signinBtnsClickLoadingState.setFinish();
  };

  return (
    <div className="page-wrapper signin">
      <div className="page-container">
        <div className="page-header-container">
          <p className="title-text">
            登录 Memos <span className="icon-text">✍️</span>
          </p>
        </div>
        {showAutoSigninAsGuest ? (
          <>
            <div className="quickly-btns-container">
              <div
                ref={autoSigninAsGuestBtn}
                className={`btn guest-signin ${signinBtnsClickLoadingState.isLoading ? "requesting" : ""}`}
                onClick={handleAutoSigninAsGuestBtnClick}
              >
                👉 快速登录进行体验
              </div>
              <div
                className={`btn ${signinBtnsClickLoadingState.isLoading ? "requesting" : ""}`}
                onClick={handleSwitchAccountSigninBtnClick}
              >
                已有账号，我要自己登录
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="page-content-container">
              <div className="form-item-container input-form-container">
                <span className={"normal-text " + (username === "" ? "" : "not-null")}>账号</span>
                <input type="text" autoComplete="off" value={username} onChange={handleUsernameInputChanged} />
              </div>
              <div className="form-item-container input-form-container">
                <span className={"normal-text " + (password === "" ? "" : "not-null")}>密码</span>
                <input type="password" autoComplete="off" value={password} onChange={handlePasswordInputChanged} />
              </div>
            </div>
            <div className="page-footer-container">
              <div className="btns-container">{/* nth */}</div>
              <div className="btns-container">
                <button
                  className={`btn ${signinBtnsClickLoadingState.isLoading ? "requesting" : ""}`}
                  onClick={handleAutoSigninAsGuestBtnClick}
                >
                  体验一下
                </button>
                <span className="split-text">/</span>
                <button
                  className={`btn signin-btn ${signinBtnsClickLoadingState.isLoading ? "requesting" : ""}`}
                  onClick={() => handleSigninBtnsClick("signup")}
                >
                  注册
                </button>
                <span className="split-text">/</span>
                <button
                  ref={signinBtn}
                  className={`btn signin-btn ${signinBtnsClickLoadingState.isLoading ? "requesting" : ""}`}
                  onClick={() => handleSigninBtnsClick("signin")}
                >
                  登录
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Signin;
