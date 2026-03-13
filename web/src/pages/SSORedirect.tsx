import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { identityProviderServiceClient } from "@/connect";
import { absolutifyLink } from "@/helpers/utils";
import useNavigateTo from "@/hooks/useNavigateTo";
import { handleError } from "@/lib/error";
import { IdentityProvider, IdentityProvider_Type } from "@/types/proto/api/v1/idp_service_pb";
import { storeOAuthState } from "@/utils/oauth";
import { toast } from "react-hot-toast";

/**
 * SSORedirect page — handles direct links to SSO login.
 *
 * Usage: /auth/sso?provider=<title>
 *   e.g. /auth/sso?provider=keycloak
 *        /auth/sso?provider=Authentik
 *
 * The page:
 *   1. Looks up the identity provider whose title matches (case-insensitive).
 *   2. Generates OAuth state (+ PKCE if available) and stores it.
 *   3. Immediately redirects the browser to the IdP authorization endpoint.
 *   4. Falls back to /auth if the provider is not found or misconfigured.
 *
 * This is safe: state generation and storage happens in the same browser
 * session, preserving full CSRF protection.
 */
const SSORedirect = () => {
  const [searchParams] = useSearchParams();
  const navigateTo = useNavigateTo();
  const initiatedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (initiatedRef.current) {
      return;
    }
    initiatedRef.current = true;

    const providerParam = searchParams.get("provider");
    if (!providerParam) {
      // No provider specified — fall back to the login page.
      navigateTo("/auth");
      return;
    }

    const initiateSSOFlow = async () => {
      let identityProviders: IdentityProvider[] = [];
      try {
        const response = await identityProviderServiceClient.listIdentityProviders({});
        identityProviders = response.identityProviders;
      } catch (error) {
        handleError(error, toast.error, {
          context: "Failed to list identity providers",
          fallbackMessage: "Failed to load identity providers. Redirecting to sign-in…",
        });
        navigateTo("/auth");
        return;
      }

      // Match provider by title (case-insensitive) or by the last segment of the
      // resource name (e.g. "identityProviders/abc" → "abc").
      const needle = providerParam.toLowerCase();
      const identityProvider = identityProviders.find((idp) => {
        const titleMatch = idp.title.toLowerCase() === needle;
        const nameSegment = idp.name.split("/").pop() ?? "";
        const nameMatch = nameSegment.toLowerCase() === needle;
        return titleMatch || nameMatch;
      });

      if (!identityProvider) {
        setErrorMessage(`SSO provider "${providerParam}" not found. Redirecting to sign-in…`);
        setTimeout(() => navigateTo("/auth"), 2000);
        return;
      }

      if (identityProvider.type !== IdentityProvider_Type.OAUTH2) {
        setErrorMessage(`Provider "${providerParam}" is not an OAuth2 provider. Redirecting to sign-in…`);
        setTimeout(() => navigateTo("/auth"), 2000);
        return;
      }

      const oauth2Config =
        identityProvider.config?.config?.case === "oauth2Config" ? identityProvider.config.config.value : undefined;
      if (!oauth2Config) {
        setErrorMessage(`Provider "${providerParam}" has an invalid configuration. Redirecting to sign-in…`);
        setTimeout(() => navigateTo("/auth"), 2000);
        return;
      }

      try {
        const redirectUri = absolutifyLink("/auth/callback");
        const { state, codeChallenge } = await storeOAuthState(identityProvider.name);

        let authUrl =
          `${oauth2Config.authUrl}` +
          `?client_id=${oauth2Config.clientId}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&state=${state}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent(oauth2Config.scopes.join(" "))}`;

        if (codeChallenge) {
          authUrl += `&code_challenge=${codeChallenge}&code_challenge_method=S256`;
        }

        window.location.href = authUrl;
      } catch (error) {
        handleError(error, toast.error, {
          context: "Failed to initiate SSO flow",
          fallbackMessage: "Failed to initiate SSO sign-in. Redirecting to sign-in…",
        });
        navigateTo("/auth");
      }
    };

    initiateSSOFlow();
  }, [searchParams, navigateTo]);

  if (errorMessage) {
    return (
      <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-center items-center gap-4">
        <p className="text-muted-foreground text-center text-sm">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-center items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground text-sm">Redirecting to SSO provider…</p>
    </div>
  );
};

export default SSORedirect;
