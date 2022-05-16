import { useEffect, useState } from "react";
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
  const pageLoadingState = useLoading(true);
  const [siteOwner, setSiteOwner] = useState<Model.User>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const actionBtnLoadingState = useLoading(false);

  useEffect(() => {
    api.getSystemStatus().then((status) => {
      setSiteOwner(status.owner);
      pageLoadingState.setFinish();
    });
  }, []);

  const handleEmailInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setEmail(text);
  };

  const handlePasswordInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setPassword(text);
  };

  const handleSigninBtnsClick = async () => {
    if (actionBtnLoadingState.isLoading) {
      return;
    }

    const emailValidResult = validate(email, validateConfig);
    if (!emailValidResult.result) {
      toastHelper.error("Email: " + emailValidResult.reason);
      return;
    }

    const passwordValidResult = validate(password, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error("Password: " + passwordValidResult.reason);
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      await api.login(email, password);
      const user = await userService.doSignIn();
      if (user) {
        locationService.replaceHistory("/");
      } else {
        toastHelper.error("😟 Login failed");
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error("😟 " + error.message);
    }
    actionBtnLoadingState.setFinish();
  };

  const handleSignUpAsOwnerBtnsClick = async () => {
    if (actionBtnLoadingState.isLoading) {
      return;
    }

    const emailValidResult = validate(email, validateConfig);
    if (!emailValidResult.result) {
      toastHelper.error("Email: " + emailValidResult.reason);
      return;
    }

    const passwordValidResult = validate(password, validateConfig);
    if (!passwordValidResult.result) {
      toastHelper.error("Password: " + passwordValidResult.reason);
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      await api.signup(email, password, "OWNER");
      const user = await userService.doSignIn();
      if (user) {
        locationService.replaceHistory("/");
      } else {
        toastHelper.error("😟 Signup failed");
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error("😟 " + error.message);
    }
    actionBtnLoadingState.setFinish();
  };

  const handleAutoSigninAsGuestBtnClick = async () => {
    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      await api.login("guest@example.com", "secret");

      const user = await userService.doSignIn();
      if (user) {
        locationService.replaceHistory("/");
      } else {
        toastHelper.error("😟 Login failed");
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error("😟 " + error.message);
    }
    actionBtnLoadingState.setFinish();
  };

  return (
    <div className="page-wrapper signin">
      <div className="page-container">
        <div className="page-header-container">
          <p className="title-text">
            <span className="icon-text">✍️</span> Memos
          </p>
        </div>
        <div className="page-content-container">
          <div className="form-item-container input-form-container">
            <span className={"normal-text " + (email === "" ? "" : "not-null")}>Email</span>
            <input type="email" value={email} onChange={handleEmailInputChanged} />
          </div>
          <div className="form-item-container input-form-container">
            <span className={"normal-text " + (password === "" ? "" : "not-null")}>Password</span>
            <input type="password" value={password} onChange={handlePasswordInputChanged} />
          </div>
        </div>
        <div className="action-btns-container">
          <button className={`btn ${actionBtnLoadingState.isLoading ? "requesting" : ""}`} onClick={handleAutoSigninAsGuestBtnClick}>
            Login as Guest
          </button>
          <span className="split-text">/</span>
          {siteOwner || pageLoadingState.isLoading ? (
            <button
              className={`btn signin-btn ${actionBtnLoadingState.isLoading ? "requesting" : ""}`}
              onClick={() => handleSigninBtnsClick()}
            >
              Sign in
            </button>
          ) : (
            <button
              className={`btn signin-btn ${actionBtnLoadingState.isLoading ? "requesting" : ""}`}
              onClick={() => handleSignUpAsOwnerBtnsClick()}
            >
              Sign up as Owner
            </button>
          )}
        </div>
        <p className="tip-text">
          {siteOwner || pageLoadingState.isLoading
            ? "If you don't have an account, please contact the site owner or login as guest."
            : "You are registering as the site owner."}
        </p>
      </div>
    </div>
  );
};

export default Signin;
