import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ClientError } from "nice-grpc-web";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import AuthFooter from "@/components/AuthFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authServiceClient, userServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { workspaceStore } from "@/store";
import { initialUserStore } from "@/store/user";
import { User, User_Role } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

const SignUp = observer(() => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

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
      const user = User.fromPartial({
        username,
        password,
        role: User_Role.USER,
      });
      await userServiceClient.createUser({ user });
      await authServiceClient.createSession({
        passwordCredentials: { username, password },
      });
      await initialUserStore();
      navigateTo("/");
    } catch (error: any) {
      console.error(error);
      toast.error((error as ClientError).details || "Sign up failed");
    }
    actionBtnLoadingState.setFinish();
  };

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={workspaceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-foreground opacity-80">{workspaceGeneralSetting.customProfile?.title || "Memos"}</p>
        </div>
        {!workspaceGeneralSetting.disallowUserRegistration ? (
          <>
            <p className="w-full text-2xl mt-2 text-muted-foreground">{t("auth.create-your-account")}</p>
            <form className="w-full mt-2" onSubmit={handleFormSubmit}>
              <div className="flex flex-col justify-start items-start w-full gap-4">
                <div className="w-full flex flex-col justify-start items-start">
                  <span className="leading-8 text-muted-foreground">{t("common.username")}</span>
                  <Input
                    className="w-full bg-background h-10"
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
                  <span className="leading-8 text-muted-foreground">{t("common.password")}</span>
                  <Input
                    className="w-full bg-background h-10"
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
              <div className="flex flex-row justify-end items-center w-full mt-6">
                <Button type="submit" className="w-full h-10" disabled={actionBtnLoadingState.isLoading} onClick={handleSignUpButtonClick}>
                  {t("common.sign-up")}
                  {actionBtnLoadingState.isLoading && <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <p className="w-full text-2xl mt-2 text-muted-foreground">Sign up is not allowed.</p>
        )}
        {!workspaceStore.state.profile.owner ? (
          <p className="w-full mt-4 text-sm font-medium text-muted-foreground">{t("auth.host-tip")}</p>
        ) : (
          <p className="w-full mt-4 text-sm">
            <span className="text-muted-foreground">{t("auth.sign-in-tip")}</span>
            <Link to="/auth" className="cursor-pointer ml-2 text-primary hover:underline" viewTransition>
              {t("common.sign-in")}
            </Link>
          </p>
        )}
      </div>
      <AuthFooter />
    </div>
  );
});

export default SignUp;
