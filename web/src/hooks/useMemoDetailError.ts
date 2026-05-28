import { Code, ConnectError } from "@connectrpc/connect";
import { useEffect } from "react";
import { toast } from "react-hot-toast";
import useNavigateTo from "@/hooks/useNavigateTo";

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

      toast.error(error.message);
      return;
    }

    toast.error(error.message);
  }, [error, navigateTo]);
};

export default useMemoDetailError;
