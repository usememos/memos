import { Button, Divider, Input } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import AppearanceSelect from "@/components/AppearanceSelect";
import Icon from "@/components/Icon";
import LocaleSelect from "@/components/LocaleSelect";
import * as api from "@/helpers/api";
import { absolutifyLink } from "@/helpers/utils";
import useLoading from "@/hooks/useLoading";
import { useGlobalStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const Auth = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const { appearance, locale, systemStatus } = globalStore.state;
  const mode = systemStatus.profile.mode;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const disablePasswordLogin = systemStatus.disablePasswordLogin;
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
        toast.error(t("message.signup-failed"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message || error.message || t("message.signup-failed"));
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
          <div className="w-full flex flex-col justify-center items-center mb-2">
            <img className="h-20 w-auto rounded-full shadow" src={systemStatus.customizedProfile.logoUrl} alt="" />
            <p className="mt-2 text-3xl text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
          </div>
          {!disablePasswordLogin && (
            <form className="w-full mt-2" onSubmit={handleFormSubmit}>
              <div className="flex flex-col justify-start items-start w-full gap-4">
                <Input
                  className="w-full"
                  size="lg"
                  type="text"
                  readOnly={actionBtnLoadingState.isLoading}
                  placeholder={t("common.username")}
                  value={username}
                  onChange={handleUsernameInputChanged}
                  required
                />
                <Input
                  className="w-full"
                  size="lg"
                  type="password"
                  readOnly={actionBtnLoadingState.isLoading}
                  placeholder={t("common.password")}
                  value={password}
                  onChange={handlePasswordInputChanged}
                  required
                />
              </div>
              <div className="flex flex-row justify-end items-center w-full mt-6">
                {actionBtnLoadingState.isLoading && <Icon.Loader className="w-4 h-auto mr-2 animate-spin dark:text-gray-300" />}
                {!systemStatus.host ? (
                  <Button disabled={actionBtnLoadingState.isLoading} onClick={handleSignUpButtonClick}>
                    {t("common.sign-up")}
                  </Button>
                ) : (
                  <>
                    {systemStatus?.allowSignUp && (
                      <>
                        <Button variant={"plain"} disabled={actionBtnLoadingState.isLoading} onClick={handleSignUpButtonClick}>
                          {t("common.sign-up")}
                        </Button>
                        <span className="mr-2 font-mono text-gray-200">/</span>
                      </>
                    )}
                    <Button type="submit" disabled={actionBtnLoadingState.isLoading} onClick={handleSignInButtonClick}>
                      {t("common.sign-in")}
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
          {!systemStatus.host && (
            <p className="w-full inline-block float-right text-sm mt-4 text-gray-500 text-right whitespace-pre-wrap">
              {t("auth.host-tip")}
            </p>
          )}
          {identityProviderList.length > 0 && (
            <>
              {!disablePasswordLogin && <Divider className="!my-4">{t("common.or")}</Divider>}
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
