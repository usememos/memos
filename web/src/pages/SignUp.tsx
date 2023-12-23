import { Button, Input } from "@mui/joy";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import AppearanceSelect from "@/components/AppearanceSelect";
import LocaleSelect from "@/components/LocaleSelect";
import * as api from "@/helpers/api";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useGlobalStore } from "@/store/module";
import { useUserStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const SignUp = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const { appearance, locale, systemStatus } = globalStore.state;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
    handleSignUpButtonClick();
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
      const { data: user } = await api.signup(username, password);
      if (user) {
        await userStore.fetchCurrentUser();
        navigateTo("/");
      } else {
        toast.error(t("message.signup-failed"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message || error.message || t("message.signup-failed"));
    }
    actionBtnLoadingState.setFinish();
  };

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-[100svh] mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={systemStatus.customizedProfile.logoUrl} alt="" />
          <p className="ml-2 text-5xl text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
        </div>
        <p className="w-full text-2xl mt-2 dark:text-gray-500">{t("auth.create-your-account")}</p>
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
          <div className="flex flex-row justify-end items-center w-full mt-6">
            <Button
              className="w-full"
              size="md"
              type="submit"
              disabled={actionBtnLoadingState.isLoading}
              loading={actionBtnLoadingState.isLoading}
              onClick={handleSignUpButtonClick}
            >
              {t("common.sign-up")}
            </Button>
          </div>
        </form>
        {!systemStatus.host && <p className="w-full mt-4 text-sm font-medium dark:text-gray-500">{t("auth.host-tip")}</p>}
        <p className="w-full mt-4 text-sm">
          <span className="dark:text-gray-500">{t("auth.sign-in-tip")}</span>
          <Link to="/auth" className="cursor-pointer ml-2 text-blue-600 hover:underline" unstable_viewTransition>
            {t("common.sign-in")}
          </Link>
        </p>
      </div>
      <div className="mt-4 flex flex-row items-center justify-center w-full gap-2">
        <LocaleSelect value={locale} onChange={handleLocaleSelectChange} />
        <AppearanceSelect value={appearance} onChange={handleAppearanceSelectChange} />
      </div>
    </div>
  );
};

export default SignUp;
