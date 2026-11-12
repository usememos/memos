import { Separator } from "@usememos/ui";
import { Link, useSearchParams } from "react-router-dom";
import AuthNotice from "@/components/AuthNotice";
import AuthPageLayout, { AuthLinkPrompt, AuthOptionsLoading } from "@/components/AuthPageLayout";
import IdentityProviderButtons from "@/components/IdentityProviderButtons";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { useInstance } from "@/contexts/InstanceContext";
import { useIdentityProviderList } from "@/hooks/useIdentityProviderQueries";
import { ROUTES } from "@/router/routes";
import {
  AUTH_REASON_PARAM,
  AUTH_REASON_SIGNUPS_CLOSED,
  AUTH_REDIRECT_PARAM,
  appendSearchParams,
  getSafeRedirectPath,
} from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignIn = () => {
  const t = useTranslate();
  const { generalSetting: instanceGeneralSetting, profile, profileLoaded, isInitialized } = useInstance();
  const [searchParams] = useSearchParams();
  const { identityProviderList, isLoading: identityProvidersLoading, isSuccess: identityProvidersLoaded } = useIdentityProviderList();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signUpPath = appendSearchParams(ROUTES.AUTH_SIGNUP, searchParams);

  const passwordAuthAllowed = !instanceGeneralSetting.disallowPasswordAuth;
  const registrationOpen = !instanceGeneralSetting.disallowUserRegistration;
  const hasIdentityProviders = identityProviderList.length > 0;
  const cameFromClosedSignUp = searchParams.get(AUTH_REASON_PARAM) === AUTH_REASON_SIGNUPS_CLOSED;

  if (!identityProvidersLoading && !passwordAuthAllowed && !hasIdentityProviders) {
    return (
      <AuthPageLayout title={t("auth.signin-unavailable-title")} description={t("auth.signin-unavailable-description")}>
        <Link to={ROUTES.AUTH_ADMIN} className="mu-body text-mu-accent hover:underline" viewTransition>
          {t("auth.admin-sign-in")}
        </Link>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("common.sign-in")}>
      {cameFromClosedSignUp && <AuthNotice className="-mt-2 mb-6">{t("auth.signups-closed-description")}</AuthNotice>}
      {identityProvidersLoading ? (
        <AuthOptionsLoading />
      ) : (
        hasIdentityProviders && (
          <IdentityProviderButtons
            identityProviderList={identityProviderList}
            redirectTarget={redirectTarget}
            // A visitor who came to sign up didn't ask to be sent to a provider.
            autoSignIn={
              isInitialized &&
              profileLoaded &&
              !profile.needsSetup &&
              !passwordAuthAllowed &&
              identityProvidersLoaded &&
              !cameFromClosedSignUp
            }
          />
        )
      )}
      {hasIdentityProviders && passwordAuthAllowed && (
        <div className="my-4 flex items-center gap-3 mu-caption-xs text-mu-ink-muted">
          <div className="flex-1">
            <Separator />
          </div>
          {t("common.or")}
          <div className="flex-1">
            <Separator />
          </div>
        </div>
      )}
      {passwordAuthAllowed && <PasswordSignInForm redirectPath={redirectTarget} />}
      {passwordAuthAllowed && registrationOpen && !cameFromClosedSignUp && (
        <AuthLinkPrompt prompt={t("auth.sign-up-tip")} to={signUpPath} label={t("common.sign-up")} />
      )}
    </AuthPageLayout>
  );
};

export default SignIn;
