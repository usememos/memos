import { Button, Checkbox, Divider, Input } from "@mui/joy";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import AppearanceSelect from "@/components/AppearanceSelect";
import LocaleSelect from "@/components/LocaleSelect";
import { authServiceClient, identityProviderServiceClient } from "@/grpcweb";
import { absolutifyLink } from "@/helpers/utils";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { extractIdentityProviderIdFromName, useUserStore, useWorkspaceSettingStore } from "@/store/v1";
import { IdentityProvider, IdentityProvider_Type } from "@/types/proto/api/v1/idp_service";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";

const SignIn = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const commonContext = useCommonContext();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const workspaceGeneralSetting =
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL).generalSetting || WorkspaceGeneralSetting.fromPartial({});

  useEffect(() => {
    const fetchIdentityProviderList = async () => {
      const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
      setIdentityProviderList(identityProviders);
    };
    fetchIdentityProviderList();
  }, []);

  useEffect(() => {
    if (commonContext.profile.mode === "demo") {
      setUsername("memos-demo");
      setPassword("secret");
    }
  }, [commonContext.profile.mode]);

  const handleUsernameInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setUsername(text);
  };

  const handlePasswordInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setPassword(text);
  };

  const handleLocaleSelectChange = (locale: Locale) => {
    commonContext.setLocale(locale);
  };

  const handleAppearanceSelectChange = (appearance: Appearance) => {
    commonContext.setAppearance(appearance);
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
      await authServiceClient.signIn({ username, password, neverExpire: remember });
      await userStore.fetchCurrentUser();
      navigateTo("/");
    } catch (error: any) {
      console.error(error);
      toast.error((error as ClientError).details || "Failed to sign in.");
    }
    actionBtnLoadingState.setFinish();
  };

  const handleSignInWithIdentityProvider = async (identityProvider: IdentityProvider) => {
    const stateQueryParameter = `auth.signin.${identityProvider.title}-${extractIdentityProviderIdFromName(identityProvider.name)}`;
    if (identityProvider.type === IdentityProvider_Type.OAUTH2) {
      const redirectUri = absolutifyLink("/auth/callback");
      const oauth2Config = identityProvider.config?.oauth2Config;
      if (!oauth2Config) {
        toast.error("Identity provider configuration is invalid.");
        return;
      }
      const authUrl = `${oauth2Config.authUrl}?client_id=${
        oauth2Config.clientId
      }&redirect_uri=${redirectUri}&state=${stateQueryParameter}&response_type=code&scope=${encodeURIComponent(
        oauth2Config.scopes.join(" "),
      )}`;
      window.location.href = authUrl;
    }
  };

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-[100svh] mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={workspaceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-black opacity-80 dark:text-gray-200">
            {workspaceGeneralSetting.customProfile?.title || "Memos"}
          </p>
        </div>
        <form className="w-full mt-2" onSubmit={handleFormSubmit}>
          <div className="flex flex-col justify-start items-start w-full gap-4">
            <div className="w-full flex flex-col justify-start items-start">
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
            <div className="w-full flex flex-col justify-start items-start">
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
        {commonContext.profile.public && (
          <p className="w-full mt-4 text-sm">
            <span className="dark:text-gray-500">{t("auth.sign-up-tip")}</span>
            <Link to="/auth/signup" className="cursor-pointer ml-2 text-blue-600 hover:underline" unstable_viewTransition>
              {t("common.sign-up")}
            </Link>
          </p>
        )}
        {identityProviderList.length > 0 && (
          <>
            <Divider className="!my-4">{t("common.or")}</Divider>
            <div className="w-full flex flex-col space-y-2">
              {identityProviderList.map((identityProvider) => (
                <Button
                  key={identityProvider.name}
                  variant="outlined"
                  color="neutral"
                  className="w-full"
                  size="md"
                  onClick={() => handleSignInWithIdentityProvider(identityProvider)}
                >
                  {t("common.sign-in-with", { provider: identityProvider.title })}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-row items-center justify-center w-full gap-2">
        <LocaleSelect value={commonContext.locale} onChange={handleLocaleSelectChange} />
        <AppearanceSelect value={commonContext.appearance as Appearance} onChange={handleAppearanceSelectChange} />
      </div>
    </div>
  );
};

export default SignIn;
