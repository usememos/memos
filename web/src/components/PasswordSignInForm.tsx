import { timestampDate } from "@bufbuild/protobuf/wkt";
import { LoaderIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { setAccessToken } from "@/auth-state";
import CredentialFields from "@/components/CredentialFields";
import { Button } from "@/components/ui/button";
import { authServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { handleError } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";

interface PasswordSignInFormProps {
  redirectPath?: string;
}

function PasswordSignInForm({ redirectPath }: PasswordSignInFormProps) {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const { initialize } = useAuth();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (username === "" || password === "") {
      return;
    }

    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      const response = await authServiceClient.signIn({
        credentials: {
          case: "passwordCredentials",
          value: { username, password },
        },
      });
      // Store access token from login response
      if (response.accessToken) {
        setAccessToken(response.accessToken, response.accessTokenExpiresAt ? timestampDate(response.accessTokenExpiresAt) : undefined);
      }
      await initialize();
      navigateTo(redirectPath || ROUTES.HOME, { replace: true });
    } catch (error: unknown) {
      handleError(error, toast.error, {
        fallbackMessage: "Failed to sign in.",
      });
    }
    actionBtnLoadingState.setFinish();
  };

  return (
    <form className="flex w-full flex-col gap-4" onSubmit={handleFormSubmit}>
      <CredentialFields
        idPrefix="signin"
        username={username}
        password={password}
        passwordAutoComplete="current-password"
        readOnly={actionBtnLoadingState.isLoading}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
      />
      <Button type="submit" disabled={actionBtnLoadingState.isLoading}>
        {t("common.sign-in")}
        {actionBtnLoadingState.isLoading && <LoaderIcon className="ml-1 h-4 w-auto animate-spin opacity-60" />}
      </Button>
    </form>
  );
}

export default PasswordSignInForm;
