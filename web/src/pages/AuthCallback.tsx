import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Spinner } from "@usememos/ui";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { setAccessToken } from "@/auth-state";
import AuthPageLayout, { AuthBackLink } from "@/components/AuthPageLayout";
import { authServiceClient, userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import { absolutifyLink } from "@/lib/browser";
import { handleError } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { buildAuthRoute, getSafeRedirectPath } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";
import { validateOAuthState } from "@/utils/oauth";

interface State {
  errorMessage: string;
  returnUrl?: string;
}

const AuthCallback = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const { currentUser, initialize, isInitialized } = useAuth();
  const [searchParams] = useSearchParams();
  const handledRef = useRef(false);
  const [state, setState] = useState<State>({
    errorMessage: "",
  });

  useEffect(() => {
    if (!isInitialized) {
      return;
    }
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;
    // Check for OAuth error response first (e.g., user denied access)
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const errorUri = searchParams.get("error_uri");

    if (error) {
      const oauthState = searchParams.get("state");
      const validatedState = oauthState ? validateOAuthState(oauthState) : null;
      // OAuth provider returned an error
      let errorMessage = `OAuth error: ${error}`;
      if (errorDescription) {
        errorMessage += `\n${decodeURIComponent(errorDescription)}`;
      }
      if (errorUri) {
        errorMessage += `\nMore info: ${errorUri}`;
      }

      setState({
        errorMessage,
        returnUrl: validatedState?.returnUrl,
      });
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setState({
        errorMessage: "Failed to authorize. Missing authorization code or state parameter.",
      });
      return;
    }

    // Validate OAuth state (CSRF protection) and retrieve PKCE code_verifier
    const validatedState = validateOAuthState(state);
    if (!validatedState) {
      setState({
        errorMessage: "Failed to authorize. Invalid or expired state parameter. This may indicate a CSRF attack attempt.",
      });
      return;
    }

    const { flowMode, identityProviderName, returnUrl, linkingUserName, codeVerifier } = validatedState;
    const redirectUri = absolutifyLink("/auth/callback");
    (async () => {
      try {
        if (flowMode === "link") {
          if (!currentUser?.name) {
            throw new Error("Failed to link account. Please sign in to Memos again and retry.");
          }
          if (linkingUserName && currentUser.name !== linkingUserName) {
            throw new Error("The signed-in user changed before the OAuth callback completed. Please retry linking from account settings.");
          }
          await userServiceClient.createLinkedIdentity({
            parent: currentUser.name,
            identityProvider: identityProviderName,
            code,
            redirectUri,
            codeVerifier: codeVerifier || "",
          });
        } else {
          const response = await authServiceClient.signIn({
            credentials: {
              case: "ssoCredentials",
              value: {
                identityProvider: identityProviderName,
                code,
                redirectUri,
                codeVerifier: codeVerifier || "", // Pass PKCE code_verifier for token exchange
              },
            },
          });
          // Store access token from login response
          if (response.accessToken) {
            setAccessToken(
              response.accessToken,
              response.accessTokenExpireTime ? timestampDate(response.accessTokenExpireTime) : undefined,
            );
          }
        }
        setState({
          errorMessage: "",
        });
        await initialize();
        // Defense-in-depth: even though `returnUrl` was sanitized before being
        // stored (see storeOAuthState in SignIn), re-validate on the way out so
        // a corrupted state entry can never be used for an open redirect.
        navigateTo(getSafeRedirectPath(returnUrl) ?? ROUTES.HOME);
      } catch (error: unknown) {
        handleError(error, () => {}, {
          fallbackMessage: t("error.authenticate-failed"),
          onError: (err) => {
            const message = err instanceof Error ? err.message : t("error.authenticate-failed");
            setState({
              errorMessage: message,
              returnUrl,
            });
          },
        });
      }
    })();
  }, [currentUser?.name, initialize, isInitialized, navigateTo, searchParams]);

  // A success navigates away, so without an error the page only ever shows the wait.
  if (!state.errorMessage) {
    return (
      <AuthPageLayout>
        <div className="flex justify-center py-6 text-mu-text-secondary">
          <Spinner />
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("auth.callback-failed-title")}>
      <pre
        role="alert"
        className="m-0 rounded-mu-md bg-mu-well px-2.5 py-2 font-mono mu-caption-xs whitespace-pre-wrap break-words text-mu-text-secondary"
      >
        {state.errorMessage}
      </pre>
      <AuthBackLink to={buildAuthRoute({ autoSignIn: false, redirect: state.returnUrl })} />
    </AuthPageLayout>
  );
};

export default AuthCallback;
