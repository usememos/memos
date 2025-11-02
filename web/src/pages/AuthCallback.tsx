import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authServiceClient } from "@/grpcweb";
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
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setState({
        loading: false,
        errorMessage: "Failed to authorize. Missing authorization code or state parameter.",
      });
      return;
    }

    // Validate OAuth state (CSRF protection)
    const validatedState = validateOAuthState(state);
    if (!validatedState) {
      setState({
        loading: false,
        errorMessage: "Failed to authorize. Invalid or expired state parameter. This may indicate a CSRF attack attempt.",
      });
      return;
    }

    const { identityProviderId, returnUrl } = validatedState;
    const redirectUri = absolutifyLink("/auth/callback");

    (async () => {
      try {
        await authServiceClient.createSession({
          ssoCredentials: {
            idpId: identityProviderId,
            code,
            redirectUri,
          },
        });
        setState({
          loading: false,
          errorMessage: "",
        });
        await initialUserStore();
        // Redirect to return URL if specified, otherwise home
        navigateTo(returnUrl || "/");
      } catch (error: any) {
        console.error(error);
        setState({
          loading: false,
          errorMessage: (error as ClientError).details,
        });
      }
    })();
  }, [searchParams]);

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
