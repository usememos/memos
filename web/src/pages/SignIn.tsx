import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import AuthFooter from "@/components/AuthFooter";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { identityProviderServiceClient } from "@/grpcweb";
import { absolutifyLink } from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { instanceStore } from "@/store";
import { extractIdentityProviderIdFromName } from "@/store/common";
import { IdentityProvider, IdentityProvider_Type } from "@/types/proto/api/v1/idp_service";
import { useTranslate } from "@/utils/i18n";
import { storeOAuthState } from "@/utils/oauth";

const SignIn = observer(() => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const instanceGeneralSetting = instanceStore.state.generalSetting;

  // Redirect to root page if already signed in.
  useEffect(() => {
    if (currentUser) {
      window.location.href = Routes.ROOT;
    }
  }, []);

  // Prepare identity provider list.
  useEffect(() => {
    const fetchIdentityProviderList = async () => {
      const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
      setIdentityProviderList(identityProviders);
    };
    fetchIdentityProviderList();
  }, []);

  const handleSignInWithIdentityProvider = async (identityProvider: IdentityProvider) => {
    if (identityProvider.type === IdentityProvider_Type.OAUTH2) {
      const redirectUri = absolutifyLink("/auth/callback");
      const oauth2Config = identityProvider.config?.oauth2Config;
      if (!oauth2Config) {
        toast.error("Identity provider configuration is invalid.");
        return;
      }

      try {
        // Generate and store secure state parameter with CSRF protection
        const identityProviderId = extractIdentityProviderIdFromName(identityProvider.name);
        const state = storeOAuthState(identityProviderId);

        // Build OAuth authorization URL with secure state
        const authUrl = `${oauth2Config.authUrl}?client_id=${
          oauth2Config.clientId
        }&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=${encodeURIComponent(
          oauth2Config.scopes.join(" "),
        )}`;

        window.location.href = authUrl;
      } catch (error) {
        console.error("Failed to initiate OAuth flow:", error);
        toast.error("Failed to initiate sign-in. Please try again.");
      }
    }
  };

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={instanceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-foreground opacity-80">{instanceGeneralSetting.customProfile?.title || "Memos"}</p>
        </div>
        {!instanceGeneralSetting.disallowPasswordAuth ? (
          <PasswordSignInForm />
        ) : (
          identityProviderList.length == 0 && <p className="w-full text-2xl mt-2 text-muted-foreground">Password auth is not allowed.</p>
        )}
        {!instanceGeneralSetting.disallowUserRegistration && !instanceGeneralSetting.disallowPasswordAuth && (
          <p className="w-full mt-4 text-sm">
            <span className="text-muted-foreground">{t("auth.sign-up-tip")}</span>
            <Link to="/auth/signup" className="cursor-pointer ml-2 text-primary hover:underline" viewTransition>
              {t("common.sign-up")}
            </Link>
          </p>
        )}
        {identityProviderList.length > 0 && (
          <>
            {!instanceGeneralSetting.disallowPasswordAuth && (
              <div className="relative my-4 w-full">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-background px-2 text-xs text-muted-foreground">{t("common.or")}</span>
                </div>
              </div>
            )}
            <div className="w-full flex flex-col space-y-2">
              {identityProviderList.map((identityProvider) => (
                <Button
                  className="bg-background w-full"
                  key={identityProvider.name}
                  variant="outline"
                  onClick={() => handleSignInWithIdentityProvider(identityProvider)}
                >
                  {t("common.sign-in-with", { provider: identityProvider.title })}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
      <AuthFooter />
    </div>
  );
});

export default SignIn;
