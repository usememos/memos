import { last } from "lodash-es";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import Icon from "@/components/Icon";
import * as api from "@/helpers/api";
import { absolutifyLink } from "@/helpers/utils";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUserStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

interface State {
  loading: boolean;
  errorMessage: string;
}

const AuthCallback = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const [searchParams] = useSearchParams();
  const userStore = useUserStore();
  const [state, setState] = useState<State>({
    loading: true,
    errorMessage: "",
  });

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      const redirectUri = absolutifyLink("/auth/callback");
      const identityProviderId = Number(last(state.split("-")));
      if (identityProviderId) {
        api
          .signinWithSSO(identityProviderId, code, redirectUri)
          .then(async ({ data: user }) => {
            setState({
              loading: false,
              errorMessage: "",
            });
            if (user) {
              await userStore.fetchCurrentUser();
              navigateTo("/");
            } else {
              toast.error(t("message.login-failed"));
            }
          })
          .catch((error: any) => {
            console.error(error);
            setState({
              loading: false,
              errorMessage: JSON.stringify(error.response.data, null, 2),
            });
          });
      }
    } else {
      setState({
        loading: false,
        errorMessage: "Failed to authorize. Invalid state passed to the auth callback.",
      });
    }
  }, [searchParams]);

  return (
    <div className="p-4 w-full h-full flex justify-center items-center">
      {state.loading ? (
        <Icon.Loader className="animate-spin dark:text-gray-200" />
      ) : (
        <div className="max-w-lg font-mono whitespace-pre-wrap opacity-80">{state.errorMessage}</div>
      )}
    </div>
  );
};

export default AuthCallback;
