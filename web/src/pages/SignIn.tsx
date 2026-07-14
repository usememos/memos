import { ArrowRightIcon, LockIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AuthPageLayout, { AuthEmptyState, AuthLinkPrompt, AuthOptionsLoading } from "@/components/AuthPageLayout";
import IdentityProviderButtons from "@/components/IdentityProviderButtons";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { Separator } from "@/components/ui/separator";
import { useInstance } from "@/contexts/InstanceContext";
import { useIdentityProviderList } from "@/hooks/useIdentityProviderQueries";
import { ROUTES } from "@/router/routes";
import { AUTH_REDIRECT_PARAM, appendSearchParams, getSafeRedirectPath } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignIn = () => {
  const t = useTranslate();
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const [searchParams] = useSearchParams();
  const { identityProviderList, isLoading: identityProvidersLoading } = useIdentityProviderList();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signUpPath = appendSearchParams(ROUTES.AUTH_SIGNUP, searchParams);

  const passwordAuthAllowed = !instanceGeneralSetting.disallowPasswordAuth;
  const hasIdentityProviders = identityProviderList.length > 0;

  // Shared by the subtitle and the body branch so they can't disagree.
  const showAuthOptions = identityProvidersLoading || passwordAuthAllowed || hasIdentityProviders;

  return (
    <AuthPageLayout title={t("common.sign-in")} subtitle={showAuthOptions ? t("auth.welcome-back") : undefined}>
      {identityProvidersLoading ? (
        <AuthOptionsLoading />
      ) : showAuthOptions ? (
        <>
          {hasIdentityProviders && <IdentityProviderButtons identityProviderList={identityProviderList} redirectTarget={redirectTarget} />}
          {hasIdentityProviders && passwordAuthAllowed && (
            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
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
          {passwordAuthAllowed && !instanceGeneralSetting.disallowUserRegistration && (
            <AuthLinkPrompt prompt={t("auth.sign-up-tip")} to={signUpPath} label={t("common.sign-up")} />
          )}
        </>
      ) : (
        <AuthEmptyState
          icon={<LockIcon className="h-5 w-5" />}
          title={t("auth.signin-unavailable-title")}
          description={t("auth.signin-unavailable-description")}
        >
          <Link to={ROUTES.AUTH_ADMIN} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" viewTransition>
            {t("auth.admin-sign-in")}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </AuthEmptyState>
      )}
    </AuthPageLayout>
  );
};

export default SignIn;
