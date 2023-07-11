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

const Auth = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const { appearance, locale, systemStatus } = globalStore.state;
  const mode = systemStatus.profile.mode;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    const fetchIdentityProviderList = async () => {
      const { data: identityProviderList } = await api.getIdentityProviderList();
      setIdentityProviderList(identityProviderList);
    };
    fetchIdentityProviderList();
  }, []);

  useEffect(() => {
    if (mode === "demo") {
      setUsername("demohero");
      setPassword("secret");
    }
  }, [mode]);

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

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (systemStatus?.host) {
      handleSignInButtonClick();
    } else {
      handleSignUpButtonClick();
    }
  };

  const handleSignInButtonClick = async () => {
    if (username === "" || password === "") {
      return;
    }

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
      toast.error(error.response.data.message || t("message.login-failed"));
    }
    actionBtnLoadingState.setFinish();
  };

  const handleSignUpButtonClick = async () => {
    if (username === "" || password === "") {
      return;
    }

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
        toast.error(t("common.signup-failed"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message || error.message || t("common.signup-failed"));
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
    <div className="flex flex-row justify-center items-center w-full h-full dark:bg-zinc-800">
      <div className="w-80 max-w-full h-full py-4 flex flex-col justify-start items-center">
        <div className="w-full py-4 grow flex flex-col justify-center items-center">
          <div className="flex flex-col justify-start items-start w-full mb-4">
            <div className="w-full flex flex-row justify-start items-center mb-2">
              <img className="h-12 w-auto rounded-lg mr-1" src={systemStatus.customizedProfile.logoUrl} alt="" />
              <p className="text-6xl tracking-wide text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {systemStatus.customizedProfile.description || t("common.memos-slogan")}
            </p>
          </div>
          <form className="w-full" onSubmit={handleFormSubmit}>
            <div className={`flex flex-col justify-start items-start w-full ${actionBtnLoadingState.isLoading && "opacity-80"}`}>
              <div className="flex flex-col justify-start items-start relative w-full text-base mt-2 py-2">
                <span
                  className={`absolute top-3 left-3 px-1 leading-10 shrink-0 text-base cursor-text text-gray-400 transition-all select-none pointer-events-none ${
                    username ? "!text-sm !top-0 !z-10 !leading-4 bg-white dark:bg-zinc-800 rounded" : ""
                  }`}
                >
                  {t("common.username")}
                </span>
                <input
                  className="input-text w-full py-3 px-3 text-base rounded-lg dark:bg-zinc-800"
                  type="text"
                  value={username}
                  onChange={handleUsernameInputChanged}
                  required
                />
              </div>
              <div className="flex flex-col justify-start items-start relative w-full text-base mt-2 py-2">
                <span
                  className={`absolute top-3 left-3 px-1 leading-10 shrink-0 text-base cursor-text text-gray-400 transition-all select-none pointer-events-none ${
                    password ? "!text-sm !top-0 !z-10 !leading-4 bg-white dark:bg-zinc-800 rounded" : ""
                  }`}
                >
                  {t("common.password")}
                </span>
                <input
                  className="input-text w-full py-3 px-3 text-base rounded-lg dark:bg-zinc-800"
                  type="password"
                  value={password}
                  onChange={handlePasswordInputChanged}
                  required
                />
              </div>
            </div>
            <div className="flex flex-row justify-end items-center w-full mt-2">
              {actionBtnLoadingState.isLoading && <Icon.Loader className="w-4 h-auto mr-2 animate-spin dark:text-gray-300" />}
              {systemStatus?.allowSignUp && (
                <>
                  <button
                    type="button"
                    className={`btn-text ${actionBtnLoadingState.isLoading ? "cursor-wait opacity-80" : ""}`}
                    onClick={handleSignUpButtonClick}
                  >
                    {t("common.sign-up")}
                  </button>
                  <span className="mr-2 font-mono text-gray-200">/</span>
                </>
              )}
              <button
                type="submit"
                className={`btn-primary ${actionBtnLoadingState.isLoading ? "cursor-wait opacity-80" : ""}`}
                onClick={handleSignInButtonClick}
              >
                {t("common.sign-in")}
              </button>
            </div>
          </form>
          {identityProviderList.length > 0 && (
            <>
              <Divider className="!my-4">{t("common.or")}</Divider>
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
                    {t("common.sign-in-with", { provider: identityProvider.name })}
                  </Button>
                ))}
              </div>
            </>
          )}
          {!systemStatus?.host && (
            <p className="w-full inline-block float-right text-sm mt-4 text-gray-500 text-right whitespace-pre-wrap">
              {t("auth.host-tip")}
            </p>
          )}
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
