import { timestampDate } from "@bufbuild/protobuf/wkt";
import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { setAccessToken } from "@/auth-state";
import { authServiceClient } from "@/connect";
import { absolutifyLink } from "@/helpers/utils";
import useNavigateTo from "@/hooks/useNavigateTo";
import { initialUserStore } from "@/store/user";
import { validateOAuthState } from "@/utils/oauth";

interface State {
  loading: boolean;
  errorMessage: string;
}

const AuthCallback = observer(() => {
  const navigateTo = useNavigateTo();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<State>({
    loading: true,
    errorMessage: "",
  });

  useEffect(() => {
    // Check for OAuth error response first (e.g., user denied access)
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const errorUri = searchParams.get("error_uri");

    if (error) {
      // OAuth provider returned an error
      let errorMessage = `OAuth error: ${error}`;
      if (errorDescription) {
        errorMessage += `\n${decodeURIComponent(errorDescription)}`;
      }
      if (errorUri) {
        errorMessage += `\nMore info: ${errorUri}`;
      }

      setState({
        loading: false,
        errorMessage,
      });
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setState({
        loading: false,
        errorMessage: "Failed to authorize. Missing authorization code or state parameter.",
      });
      return;
    }

    // Validate OAuth state (CSRF protection) and retrieve PKCE code_verifier
    const validatedState = validateOAuthState(state);
    if (!validatedState) {
      setState({
        loading: false,
        errorMessage: "Failed to authorize. Invalid or expired state parameter. This may indicate a CSRF attack attempt.",
      });
      return;
    }

    const { identityProviderId, returnUrl, codeVerifier } = validatedState;
    const redirectUri = absolutifyLink("/auth/callback");

    (async () => {
      try {
        const response = await authServiceClient.signIn({
          credentials: {
            case: "ssoCredentials",
            value: {
              idpId: identityProviderId,
              code,
              redirectUri,
              codeVerifier: codeVerifier || "", // Pass PKCE code_verifier for token exchange
            },
          },
        });
        // Store access token from login response
        if (response.accessToken) {
          setAccessToken(response.accessToken, response.accessTokenExpiresAt ? timestampDate(response.accessTokenExpiresAt) : undefined);
        }
        setState({
          loading: false,
          errorMessage: "",
        });
        await initialUserStore();
        // Redirect to return URL if specified, otherwise home
        navigateTo(returnUrl || "/");
      } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to authenticate.";
        setState({
          loading: false,
          errorMessage: message,
        });
      }
    })();
  }, [searchParams, navigateTo]);

  return (
    <div className="p-4 py-24 w-full h-full flex justify-center items-center">
      {state.loading ? (
        <LoaderIcon className="animate-spin text-foreground" />
      ) : (
        <div className="max-w-lg font-mono whitespace-pre-wrap opacity-80">{state.errorMessage}</div>
      )}
    </div>
  );
});

export default AuthCallback;
