import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { InfoIcon, LoaderIcon, LockIcon, SparklesIcon, UserRoundXIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { setAccessToken } from "@/auth-state";
import AuthPageLayout, { AuthChip, AuthEmptyState, AuthLinkPrompt, AuthOptionsLoading } from "@/components/AuthPageLayout";
import CredentialFields from "@/components/CredentialFields";
import IdentityProviderButtons from "@/components/IdentityProviderButtons";
import { Button } from "@/components/ui/button";
import { authServiceClient, userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useIdentityProviderList } from "@/hooks/useIdentityProviderQueries";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { handleError } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { User_Role, UserSchema } from "@/types/proto/api/v1/user_service_pb";
import { AUTH_REDIRECT_PARAM, appendSearchParams, getSafeRedirectPath } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignUp = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { initialize: initAuth } = useAuth();
  const { generalSetting: instanceGeneralSetting, profile, initialize: initInstance } = useInstance();
  const [searchParams] = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signInPath = appendSearchParams(ROUTES.AUTH, searchParams);

  const passwordAuthAllowed = !instanceGeneralSetting.disallowPasswordAuth;
  const registrationOpen = !instanceGeneralSetting.disallowUserRegistration;
  const needsSetup = profile.needsSetup;
  // Provider buttons only render on the SSO-provisioned branch below; skip the request elsewhere.
  const { identityProviderList, isLoading: identityProvidersLoading } = useIdentityProviderList(
    !needsSetup && registrationOpen && !passwordAuthAllowed,
  );
  const hasIdentityProviders = identityProviderList.length > 0;

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
      const user = create(UserSchema, {
        username,
        password,
        role: User_Role.USER,
      });
      await userServiceClient.createUser({ user });
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
      // Refresh auth context to load the current user
      await initAuth();
      // Refetch instance profile to update the initialized status
      await initInstance();
      navigateTo(redirectTarget || ROUTES.HOME, { replace: true });
    } catch (error: unknown) {
      handleError(error, toast.error, {
        fallbackMessage: "Sign up failed",
      });
    }
    actionBtnLoadingState.setFinish();
  };

  const signUpForm = (
    <form className="flex w-full flex-col gap-4" onSubmit={handleFormSubmit}>
      <CredentialFields
        idPrefix="signup"
        username={username}
        password={password}
        passwordAutoComplete="new-password"
        readOnly={actionBtnLoadingState.isLoading}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
      />
      <Button type="submit" disabled={actionBtnLoadingState.isLoading}>
        {needsSetup ? t("auth.create-admin-account") : t("common.sign-up")}
        {actionBtnLoadingState.isLoading && <LoaderIcon className="ml-1 h-4 w-auto animate-spin opacity-60" />}
      </Button>
    </form>
  );

  const signInPrompt = <AuthLinkPrompt prompt={t("auth.sign-in-tip")} to={signInPath} label={t("common.sign-in")} />;

  // First run: create the instance owner account.
  if (needsSetup) {
    return (
      <AuthPageLayout
        chip={
          <AuthChip>
            <SparklesIcon className="h-3 w-3" />
            {t("auth.first-run")}
          </AuthChip>
        }
        title={t("auth.setup-title")}
        subtitle={t("auth.setup-description")}
        hideExplore
      >
        {signUpForm}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-accent/50 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("auth.setup-note")}
        </div>
      </AuthPageLayout>
    );
  }

  // Registration closed.
  if (!registrationOpen) {
    return (
      <AuthPageLayout title={t("auth.create-your-account")}>
        <AuthEmptyState
          icon={<UserRoundXIcon className="h-5 w-5" />}
          title={t("auth.signups-closed-title")}
          description={t("auth.signups-closed-description")}
        />
        {signInPrompt}
      </AuthPageLayout>
    );
  }

  // Password sign-up disallowed: accounts come from the identity provider.
  if (!passwordAuthAllowed) {
    // Shared by the subtitle and the body branch so they can't disagree.
    const showSsoOptions = identityProvidersLoading || hasIdentityProviders;
    return (
      <AuthPageLayout title={t("auth.create-your-account")} subtitle={showSsoOptions ? t("auth.sso-signup-tip") : undefined}>
        {identityProvidersLoading ? (
          <AuthOptionsLoading />
        ) : showSsoOptions ? (
          <IdentityProviderButtons identityProviderList={identityProviderList} redirectTarget={redirectTarget} />
        ) : (
          <AuthEmptyState
            icon={<LockIcon className="h-5 w-5" />}
            title={t("auth.signup-unavailable-title")}
            description={t("auth.signup-unavailable-description")}
          />
        )}
        {signInPrompt}
      </AuthPageLayout>
    );
  }

  // Open registration.
  return (
    <AuthPageLayout title={t("auth.create-your-account")}>
      {signUpForm}
      {signInPrompt}
    </AuthPageLayout>
  );
};

export default SignUp;
