import { Button, Checkbox, Input } from "@usememos/mui";
import { LoaderIcon } from "lucide-react";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { authServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useUserStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const PasswordSignInForm = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const commonContext = useCommonContext();
  const userStore = useUserStore();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (commonContext.profile.mode === "demo") {
      setUsername("yourselfhosted");
      setPassword("yourselfhosted");
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

  return (
    <form className="w-full mt-2" onSubmit={handleFormSubmit}>
      <div className="flex flex-col justify-start items-start w-full gap-4">
        <div className="w-full flex flex-col justify-start items-start">
          <span className="leading-8 text-gray-600">{t("common.username")}</span>
          <Input
            className="w-full bg-white dark:bg-black"
            size="lg"
            type="text"
            readOnly={actionBtnLoadingState.isLoading}
            placeholder={t("common.username")}
            value={username}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            onChange={handleUsernameInputChanged}
            required
          />
        </div>
        <div className="w-full flex flex-col justify-start items-start">
          <span className="leading-8 text-gray-600">{t("common.password")}</span>
          <Input
            className="w-full bg-white dark:bg-black"
            size="lg"
            type="password"
            readOnly={actionBtnLoadingState.isLoading}
            placeholder={t("common.password")}
            value={password}
            autoComplete="password"
            autoCapitalize="off"
            spellCheck={false}
            onChange={handlePasswordInputChanged}
            required
          />
        </div>
      </div>
      <div className="flex flex-row justify-start items-center w-full mt-6">
        <Checkbox label={t("common.remember-me")} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
      </div>
      <div className="flex flex-row justify-end items-center w-full mt-6">
        <Button
          type="submit"
          color="primary"
          size="lg"
          fullWidth
          disabled={actionBtnLoadingState.isLoading}
          onClick={handleSignInButtonClick}
        >
          {t("common.sign-in")}
          {actionBtnLoadingState.isLoading && <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />}
        </Button>
      </div>
    </form>
  );
};

export default PasswordSignInForm;
