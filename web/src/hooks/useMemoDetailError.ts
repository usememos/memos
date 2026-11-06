import { Code, ConnectError } from "@connectrpc/connect";
import { useEffect } from "react";
import useNavigateTo from "@/hooks/useNavigateTo";
import { showErrorToast } from "@/lib/toast";

interface UseMemoDetailErrorOptions {
  error: Error | null;
}

const useMemoDetailError = ({ error }: UseMemoDetailErrorOptions) => {
  const navigateTo = useNavigateTo();

  useEffect(() => {
    if (!error) {
      return;
    }

    if (error instanceof ConnectError) {
      if (error.code === Code.Unauthenticated || error.code === Code.PermissionDenied || error.code === Code.NotFound) {
        navigateTo("/404", { replace: true });
        return;
      }

      showErrorToast(error.message);
      return;
    }

    showErrorToast(error.message);
  }, [error, navigateTo]);
};

export default useMemoDetailError;
