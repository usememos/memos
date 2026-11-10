import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code } from "@connectrpc/connect";
import { Button } from "@usememos/ui";
import { useState } from "react";
import { setAccessToken } from "@/auth-state";
import AuthNotice from "@/components/AuthNotice";
import ChallengeWidget, { CHALLENGE_TOKEN_HEADER } from "@/components/ChallengeWidget";
import CredentialFields from "@/components/CredentialFields";
import { authServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { ERROR_REASON_CHALLENGE_REQUIRED, getErrorMessage, hasConnectCode, hasErrorReason } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";

interface PasswordSignInFormProps {
  redirectPath?: string;
}

interface SignInError {
  message: string;
  // The server rejected the username and password themselves, so both fields are marked.
  credentials: boolean;
}

function PasswordSignInForm({ redirectPath }: PasswordSignInFormProps) {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const { initialize } = useAuth();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<SignInError>();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeResetKey, setChallengeResetKey] = useState(0);

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
      setError(undefined);
      const response = await authServiceClient.signIn(
        {
          credentials: {
            case: "passwordCredentials",
            value: { username, password },
          },
        },
        challengeToken ? { headers: { [CHALLENGE_TOKEN_HEADER]: challengeToken } } : undefined,
      );
      // Store access token from login response
      if (response.accessToken) {
        setAccessToken(response.accessToken, response.accessTokenExpireTime ? timestampDate(response.accessTokenExpireTime) : undefined);
      }
      await initialize();
      navigateTo(redirectPath || ROUTES.HOME, { replace: true });
    } catch (err: unknown) {
      console.error(err);
      if (hasErrorReason(err, ERROR_REASON_CHALLENGE_REQUIRED)) {
        setChallengeResetKey((key) => key + 1);
        setError({ message: getErrorMessage(err), credentials: false });
      } else if (hasConnectCode(err, Code.InvalidArgument)) {
        // The server answers an unknown user and a wrong password alike, so the message names neither.
        setError({ message: t("auth.incorrect-credentials"), credentials: true });
      } else {
        setError({ message: getErrorMessage(err, t("error.sign-in-failed")), credentials: false });
      }
    }
    actionBtnLoadingState.setFinish();
  };

  const clearCredentialError = () => {
    if (error?.credentials) setError(undefined);
  };

  return (
    <form className="flex w-full flex-col gap-4" onSubmit={handleFormSubmit}>
      <CredentialFields
        idPrefix="signin"
        username={username}
        password={password}
        passwordAutoComplete="current-password"
        readOnly={actionBtnLoadingState.isLoading}
        invalid={error?.credentials ?? false}
        onUsernameChange={(value) => {
          setUsername(value);
          clearCredentialError();
        }}
        onPasswordChange={(value) => {
          setPassword(value);
          clearCredentialError();
        }}
      />
      <ChallengeWidget onToken={setChallengeToken} resetKey={challengeResetKey} />
      {error && <AuthNotice tone="error">{error.message}</AuthNotice>}
      <Button variant="primary" type="submit" loading={actionBtnLoadingState.isLoading} loadingLabel={t("common.sign-in")}>
        {t("common.sign-in")}
      </Button>
    </form>
  );
}

export default PasswordSignInForm;
