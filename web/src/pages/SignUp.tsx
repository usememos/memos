import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Button } from "@usememos/ui";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { setAccessToken } from "@/auth-state";
import AuthNotice from "@/components/AuthNotice";
import AuthPageLayout, { AuthLinkPrompt } from "@/components/AuthPageLayout";
import ChallengeWidget, { CHALLENGE_TOKEN_HEADER } from "@/components/ChallengeWidget";
import CredentialFields from "@/components/CredentialFields";
import { authServiceClient, userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { ERROR_REASON_CHALLENGE_REQUIRED, getErrorMessage, hasErrorReason } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { User_Role, UserSchema } from "@/types/proto/api/user_service_pb";
import {
  AUTH_REASON_PARAM,
  AUTH_REASON_SIGNUPS_CLOSED,
  AUTH_REDIRECT_PARAM,
  appendSearchParams,
  getSafeRedirectPath,
} from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignUp = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeResetKey, setChallengeResetKey] = useState(0);
  const { initialize: initAuth } = useAuth();
  const { generalSetting: instanceGeneralSetting, profile, initialize: initInstance } = useInstance();
  const [searchParams] = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signInPath = appendSearchParams(ROUTES.AUTH, searchParams);

  const passwordAuthAllowed = !instanceGeneralSetting.disallowPasswordAuth;
  const registrationOpen = !instanceGeneralSetting.disallowUserRegistration;
  const needsSetup = profile.needsSetup;

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
      setErrorMessage("");
      const user = create(UserSchema, {
        username,
        password,
        role: User_Role.USER,
      });
      // The token is spent by createUser; the sign-in that follows is not a
      // credential guess, and the server does not ask for a second one there.
      const callOptions = challengeToken ? { headers: { [CHALLENGE_TOKEN_HEADER]: challengeToken } } : undefined;
      await userServiceClient.createUser({ user }, callOptions);
      const response = await authServiceClient.signIn(
        {
          credentials: {
            case: "passwordCredentials",
            value: { username, password },
          },
        },
        callOptions,
      );
      // Store access token from login response
      if (response.accessToken) {
        setAccessToken(response.accessToken, response.accessTokenExpireTime ? timestampDate(response.accessTokenExpireTime) : undefined);
      }
      // Refresh auth context to load the current user
      await initAuth();
      // Refetch instance profile to update the initialized status
      await initInstance();
      navigateTo(redirectTarget || ROUTES.HOME, { replace: true });
    } catch (error: unknown) {
      console.error(error);
      if (hasErrorReason(error, ERROR_REASON_CHALLENGE_REQUIRED)) {
        setChallengeResetKey((key) => key + 1);
      }
      setErrorMessage(getErrorMessage(error, t("error.sign-up-failed")));
    }
    actionBtnLoadingState.setFinish();
  };

  // Without password accounts, an identity provider creates the account on first sign-in, so sign-up is sign-in.
  if (!needsSetup && (!registrationOpen || !passwordAuthAllowed)) {
    const params = new URLSearchParams(searchParams);
    if (!registrationOpen) {
      params.set(AUTH_REASON_PARAM, AUTH_REASON_SIGNUPS_CLOSED);
    }
    return <Navigate to={appendSearchParams(ROUTES.AUTH, params)} replace />;
  }

  const submitLabel = needsSetup ? t("auth.create-admin-account") : t("common.sign-up");

  return (
    <AuthPageLayout
      title={needsSetup ? t("auth.setup-title") : t("auth.create-your-account")}
      description={needsSetup ? t("auth.setup-description") : undefined}
    >
      <form className="flex w-full flex-col gap-4" onSubmit={handleFormSubmit}>
        <CredentialFields
          idPrefix="signup"
          username={username}
          password={password}
          passwordAutoComplete="new-password"
          readOnly={actionBtnLoadingState.isLoading}
          onUsernameChange={(value) => {
            setUsername(value);
            setErrorMessage("");
          }}
          onPasswordChange={(value) => {
            setPassword(value);
            setErrorMessage("");
          }}
        />
        {!needsSetup && <ChallengeWidget onToken={setChallengeToken} resetKey={challengeResetKey} />}
        {errorMessage && <AuthNotice tone="error">{errorMessage}</AuthNotice>}
        <Button variant="primary" type="submit" loading={actionBtnLoadingState.isLoading} loadingLabel={submitLabel}>
          {submitLabel}
        </Button>
      </form>
      {!needsSetup && <AuthLinkPrompt prompt={t("auth.sign-in-tip")} to={signInPath} label={t("common.sign-in")} />}
    </AuthPageLayout>
  );
};

export default SignUp;
