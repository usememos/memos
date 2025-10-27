import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ClientError } from "nice-grpc-web";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { workspaceStore } from "@/store";
import { initialUserStore } from "@/store/user";
import { useTranslate } from "@/utils/i18n";

const PasswordSignInForm = observer(() => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState(workspaceStore.state.profile.mode === "demo" ? "demo" : "");
  const [password, setPassword] = useState(workspaceStore.state.profile.mode === "demo" ? "secret" : "");

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
      await authServiceClient.createSession({
        passwordCredentials: { username, password },
      });
      await initialUserStore();
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
        <Button type="submit" className="w-full h-10" disabled={actionBtnLoadingState.isLoading} onClick={handleSignInButtonClick}>
          {t("common.sign-in")}
          {actionBtnLoadingState.isLoading && <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />}
        </Button>
      </div>
    </form>
  );
});

export default PasswordSignInForm;
