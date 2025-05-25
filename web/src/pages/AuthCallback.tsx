import { last } from "lodash-es";
import { LoaderIcon } from "lucide-react";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@usememos/mui";
import { authServiceClient } from "@/grpcweb";
import { absolutifyLink } from "@/helpers/utils";
import useNavigateTo from "@/hooks/useNavigateTo";
import { workspaceStore } from "@/store/v2";
import { initialUserStore } from "@/store/v2/user";

interface State {
  loading: boolean;
  errorMessage: string;
  redirectCountdown?: number;
}

const AuthCallback = () => {
  const navigateTo = useNavigateTo();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<State>({
    loading: true,
    errorMessage: "",
  });
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setState({
        loading: false,
        errorMessage: "Failed to authorize. Invalid state passed to the auth callback.",
      });
      return;
    }

    const identityProviderId = Number(last(state.split("-")));
    if (!identityProviderId) {
      setState({
        loading: false,
        errorMessage: "No identity provider ID found in the state parameter.",
      });
      return;
    }

    const redirectUri = absolutifyLink("/auth/callback");
    (async () => {
      try {
        await authServiceClient.signIn({
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
        navigateTo("/");
      } catch (error: any) {
        console.error(error);
        const errorDetails = (error as ClientError).details;
        
        // If user registration is disallowed and the error indicates that sign up is not allowed
        if (workspaceGeneralSetting.disallowUserRegistration && 
            (errorDetails.includes("registration is not allowed") || 
             errorDetails.includes("sign up is not allowed"))) {
          const redirectSeconds = 2;
          setState({
            loading: false,
            errorMessage: errorDetails || "Sign up is not allowed.",
            redirectCountdown: redirectSeconds,
          });
          
          // Set up countdown timer
          const countdownInterval = setInterval(() => {
            setState((prevState) => ({
              ...prevState,
              redirectCountdown: prevState.redirectCountdown ? prevState.redirectCountdown - 1 : 0,
            }));
          }, 1000);
          
          // Add a timer to redirect to the login page after the countdown
          const redirectTimer = setTimeout(() => {
            navigateTo("/auth");
          }, redirectSeconds * 1000);
          
          return () => {
            clearTimeout(redirectTimer);
            clearInterval(countdownInterval);
          };
        } else {
          // Other errors
          setState({
            loading: false,
            errorMessage: errorDetails || "Authentication failed",
          });
        }
      }
    })();
  }, [searchParams, workspaceGeneralSetting.disallowUserRegistration]);

  const handleReturnToLogin = () => {
    navigateTo("/auth");
  };

  return (
    <div className="p-4 py-24 w-full h-full flex justify-center items-center">
      {state.loading ? (
        <LoaderIcon className="animate-spin dark:text-gray-200" />
      ) : (
        <div className="flex flex-col items-center">
          <div className="max-w-lg font-mono whitespace-pre-wrap opacity-80 mb-4">{state.errorMessage}</div>
          {state.redirectCountdown !== undefined && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <LoaderIcon className="w-4 h-4 animate-spin" />
                <span>Redirecting to login page in {state.redirectCountdown} {state.redirectCountdown === 1 ? 'second' : 'seconds'}...</span>
              </div>
              <Button 
                color="primary" 
                size="sm" 
                onClick={handleReturnToLogin}
              >
                Return to Login Now
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthCallback;