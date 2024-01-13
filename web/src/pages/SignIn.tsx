import { Button, Checkbox, Divider, Input } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import AppearanceSelect from "@/components/AppearanceSelect";
import LocaleSelect from "@/components/LocaleSelect";
import * as api from "@/helpers/api";
import { absolutifyLink } from "@/helpers/utils";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useGlobalStore } from "@/store/module";
import { useUserStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const SignIn = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const { appearance, locale, systemStatus } = globalStore.state;
  const mode = systemStatus.profile.mode;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
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
      setUsername("memos-demo");
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
    handleSignInButtonClick();
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
      const { data: user } = await api.signin(username, password, remember);
      if (user) {
        await userStore.fetchCurrentUser();
        navigateTo("/");
      } else {
        toast.error(t("message.login-failed"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message || t("message.login-failed"));
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
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-[100svh] mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={systemStatus.customizedProfile.logoUrl} alt="" />
          <p className="ml-2 text-5xl text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
        </div>
        {!disablePasswordLogin && (
          <>
            <form className="w-full mt-2" onSubmit={handleFormSubmit}>
              <div className="flex flex-col justify-start items-start w-full gap-4">
                <div className="w-full flex flex-col justify-start items-start gap-2">
                  <span className="leading-8 text-gray-600">{t("common.username")}</span>
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
                </div>
                <div className="w-full flex flex-col justify-start items-start gap-2">
                  <span className="leading-8 text-gray-600">{t("common.password")}</span>
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
              </div>
              <div className="flex flex-row justify-start items-center w-full mt-6">
                <Checkbox
                  className="dark:!text-gray-400"
                  label={t("common.remember-me")}
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
              </div>
              <div className="flex flex-row justify-end items-center w-full mt-6">
                <Button
                  className="w-full"
                  size="md"
                  type="submit"
                  disabled={actionBtnLoadingState.isLoading}
                  loading={actionBtnLoadingState.isLoading}
                  onClick={handleSignInButtonClick}
                >
                  {t("common.sign-in")}
                </Button>
              </div>
            </form>
            {systemStatus.allowSignUp && (
              <p className="w-full mt-4 text-sm">
                <span className="dark:text-gray-500">{t("auth.sign-up-tip")}</span>
                <Link to="/auth/signup" className="cursor-pointer ml-2 text-blue-600 hover:underline" unstable_viewTransition>
                  {t("common.sign-up")}
                </Link>
              </p>
            )}
          </>
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
      <div className="mt-4 flex flex-row items-center justify-center w-full gap-2">
        <LocaleSelect value={locale} onChange={handleLocaleSelectChange} />
        <AppearanceSelect value={appearance} onChange={handleAppearanceSelectChange} />
      </div>
    </div>
  );
};

export default SignIn;
