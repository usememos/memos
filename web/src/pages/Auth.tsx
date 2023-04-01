import { Button, Divider } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useUserStore } from "@/store/module";
import * as api from "@/helpers/api";
import { absolutifyLink } from "@/helpers/utils";
import useLoading from "@/hooks/useLoading";
import Icon from "@/components/Icon";
import AppearanceSelect from "@/components/AppearanceSelect";
import LocaleSelect from "@/components/LocaleSelect";
import "@/less/auth.less";

const Auth = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const { appearance, locale, systemStatus } = globalStore.state;
  const mode = systemStatus.profile.mode;
  const [username, setUsername] = useState(mode === "demo" ? "demohero" : "");
  const [password, setPassword] = useState(mode === "demo" ? "secret" : "");
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    userStore.doSignOut().catch();
    const fetchIdentityProviderList = async () => {
      const {
        data: { data: identityProviderList },
      } = await api.getIdentityProviderList();
      setIdentityProviderList(identityProviderList);
    };
    fetchIdentityProviderList();
  }, []);

  const handleUsernameInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setUsername(text);
  };

  const handlePasswordInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setPassword(text);
  };

  const handleLocaleSelectChange = (locale: Locale) => {
    globalStore.setLocale(locale);
  };

  const handleAppearanceSelectChange = (appearance: Appearance) => {
    globalStore.setAppearance(appearance);
  };

  const handleSignInBtnClick = async () => {
    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      await api.signin(username, password);
      const user = await userStore.doSignIn();
      if (user) {
        window.location.href = "/";
      } else {
        toast.error(t("message.login-failed"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.error);
    }
    actionBtnLoadingState.setFinish();
  };

  const handleSignUpBtnsClick = async () => {
    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      await api.signup(username, password);
      const user = await userStore.doSignIn();
      if (user) {
        window.location.href = "/";
      } else {
        toast.error(t("common.singup-failed"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.error);
    }
    actionBtnLoadingState.setFinish();
  };

  const handleSignInWithIdentityProvider = async (identityProvider: IdentityProvider) => {
    const stateQueryParameter = `auth.signin.${identityProvider.name}-${identityProvider.id}`;
    if (identityProvider.type === "OAUTH2") {
      const redirectUri = absolutifyLink("/auth/callback");
      const oauth2Config = identityProvider.config.oauth2Config;
      const authUrl = `${oauth2Config.authUrl}?client_id=${
        oauth2Config.clientId
      }&redirect_uri=${redirectUri}&state=${stateQueryParameter}&response_type=code&scope=${encodeURIComponent(
        oauth2Config.scopes.join(" ")
      )}`;
      window.location.href = authUrl;
    }
  };

  return (
    <div className="page-wrapper auth">
      <div className="page-container">
        <div className="auth-form-wrapper">
          <div className="page-header-container">
            <div className="title-container">
              <img className="logo-img" src={systemStatus.customizedProfile.logoUrl} alt="" />
              <p className="logo-text">{systemStatus.customizedProfile.name}</p>
            </div>
            <p className="slogan-text">{systemStatus.customizedProfile.description || t("slogan")}</p>
          </div>
          <div className={`page-content-container ${actionBtnLoadingState.isLoading ? "requesting" : ""}`}>
            <div className="form-item-container input-form-container">
              <span className={`normal-text ${username ? "not-null" : ""}`}>{t("common.username")}</span>
              <input className="input-text" type="text" value={username} onChange={handleUsernameInputChanged} required />
            </div>
            <div className="form-item-container input-form-container">
              <span className={`normal-text ${password ? "not-null" : ""}`}>{t("common.password")}</span>
              <input className="input-text" type="password" value={password} onChange={handlePasswordInputChanged} required />
            </div>
          </div>
          <div className="action-btns-container">
            {systemStatus?.host ? (
              <>
                {actionBtnLoadingState.isLoading && <Icon.Loader className="w-4 h-auto mr-2 animate-spin dark:text-gray-300" />}
                {systemStatus?.allowSignUp && (
                  <>
                    <button className={`btn-text ${actionBtnLoadingState.isLoading ? "requesting" : ""}`} onClick={handleSignUpBtnsClick}>
                      {t("common.sign-up")}
                    </button>
                    <span className="mr-2 font-mono text-gray-200">/</span>
                  </>
                )}
                <button className={`btn-primary ${actionBtnLoadingState.isLoading ? "requesting" : ""}`} onClick={handleSignInBtnClick}>
                  {t("common.sign-in")}
                </button>
              </>
            ) : (
              <>
                <button className={`btn-primary ${actionBtnLoadingState.isLoading ? "requesting" : ""}`} onClick={handleSignUpBtnsClick}>
                  {t("auth.signup-as-host")}
                </button>
              </>
            )}
          </div>
          {identityProviderList.length > 0 && (
            <>
              <Divider className="!my-4">or</Divider>
              <div className="w-full flex flex-col space-y-2">
                {identityProviderList.map((identityProvider) => (
                  <Button
                    key={identityProvider.id}
                    variant="outlined"
                    color="neutral"
                    className="w-full"
                    size="md"
                    onClick={() => handleSignInWithIdentityProvider(identityProvider)}
                  >
                    Sign in with {identityProvider.name}
                  </Button>
                ))}
              </div>
            </>
          )}
          {!systemStatus?.host && <p className="tip-text">{t("auth.host-tip")}</p>}
        </div>
        <div className="flex flex-row items-center justify-center w-full gap-2">
          <LocaleSelect value={locale} onChange={handleLocaleSelectChange} />
          <AppearanceSelect value={appearance} onChange={handleAppearanceSelectChange} />
        </div>
      </div>
    </div>
  );
};

export default Auth;
