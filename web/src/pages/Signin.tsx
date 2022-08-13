import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import { validate, ValidatorConfig } from "../helpers/validator";
import useI18n from "../hooks/useI18n";
import useLoading from "../hooks/useLoading";
import { locationService, userService } from "../services";
import toastHelper from "../components/Toast";
import GitHubBadge from "../components/GitHubBadge";
import "../less/signin.less";

interface Props {}

const validateConfig: ValidatorConfig = {
  minLength: 4,
  maxLength: 24,
  noSpace: true,
  noChinese: true,
};

const Signin: React.FC<Props> = () => {
  const { t } = useI18n();
  const pageLoadingState = useLoading(true);
  const [siteHost, setSiteHost] = useState<User>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const actionBtnLoadingState = useLoading(false);

  useEffect(() => {
    api.getSystemStatus().then(({ data }) => {
      const { data: status } = data;
      setSiteHost(status.host);
      if (status.profile.mode === "dev") {
        setEmail("demo@usememos.com");
        setPassword("secret");
      }
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
      await api.signin(email, password);
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

  const handleSignUpAsHostBtnsClick = async () => {
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
      await api.signup(email, password, "HOST");
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

  return (
    <div className="page-wrapper signin">
      <div className="page-container">
        <div className="page-header-container">
          <div className="title-container">
            <p className="title-text">
              <span className="icon-text">✍️</span> Memos
            </p>
            <GitHubBadge />
          </div>
          <p className="slogan-text">
            An <i>open source</i>, <i>self-hosted</i> knowledge base that works with a SQLite db file.
          </p>
        </div>
        <div className={`page-content-container ${actionBtnLoadingState.isLoading ? "requesting" : ""}`}>
          <div className="form-item-container input-form-container">
            <span className={`normal-text ${email ? "not-null" : ""}`}>{t("common.email")}</span>
            <input type="email" value={email} onChange={handleEmailInputChanged} />
          </div>
          <div className="form-item-container input-form-container">
            <span className={`normal-text ${password ? "not-null" : ""}`}>{t("common.password")}</span>
            <input type="password" value={password} onChange={handlePasswordInputChanged} />
          </div>
        </div>
        <div className="action-btns-container">
          {siteHost || pageLoadingState.isLoading ? (
            <button
              className={`btn signin-btn ${actionBtnLoadingState.isLoading ? "requesting" : ""}`}
              onClick={() => handleSigninBtnsClick()}
            >
              {t("common.sign-in")}
            </button>
          ) : (
            <button
              className={`btn signin-btn ${actionBtnLoadingState.isLoading ? "requesting" : ""}`}
              onClick={() => handleSignUpAsHostBtnsClick()}
            >
              Sign up as Host
            </button>
          )}
        </div>
        <p className={`tip-text ${siteHost || pageLoadingState.isLoading ? "" : "host-tip"}`}>
          {siteHost || pageLoadingState.isLoading
            ? "If you don't have an account, please\ncontact the site host."
            : "You are registering as the Site Host."}
        </p>
      </div>
    </div>
  );
};

export default Signin;
