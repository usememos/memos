import { authServiceClient } from "@/connect";
import { absolutifyLink } from "@/lib/browser";
import { ROUTES } from "@/router/routes";
import { IdentityProvider, IdentityProvider_Type } from "@/types/proto/api/idp_service_pb";
import { getSafeRedirectPath } from "@/utils/auth-redirect";
import { generatePKCEPair, storeOAuthState } from "@/utils/oauth";

export function getSSOConfig(identityProvider: IdentityProvider) {
  if (identityProvider.type !== IdentityProvider_Type.OAUTH2 || identityProvider.config?.config.case !== "oauth2Config") {
    return undefined;
  }
  const config = identityProvider.config.config.value;
  return config.authUrl && config.clientId ? config : undefined;
}

/** Prepares the same OAuth state and PKCE parameters for automatic and manual sign-in. */
export async function prepareSSOSignIn(identityProvider: IdentityProvider, redirectTarget?: string): Promise<string> {
  const config = getSSOConfig(identityProvider);
  if (!config) {
    throw new Error("Identity provider configuration is invalid.");
  }
  const authUrl = new URL(config.authUrl);
  if (authUrl.protocol !== "https:" && authUrl.protocol !== "http:") {
    throw new Error("Identity provider configuration is invalid.");
  }
  const redirectUri = absolutifyLink(ROUTES.AUTH_CALLBACK);
  const { codeVerifier, codeChallenge } = await generatePKCEPair();
  // The server mints and records the state; the callback must present the same
  // token to redeem the authorization code.
  const { state } = await authServiceClient.createSSOAuthorizationState({
    identityProvider: identityProvider.name,
    redirectUri,
    pkceRequired: !!codeChallenge,
  });
  storeOAuthState(state, identityProvider.name, "signin", getSafeRedirectPath(redirectTarget), undefined, codeVerifier);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  if (codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }
  return authUrl.toString();
}

export async function signInWithSSO(identityProvider: IdentityProvider, redirectTarget?: string): Promise<void> {
  window.location.assign(await prepareSSOSignIn(identityProvider, redirectTarget));
}
