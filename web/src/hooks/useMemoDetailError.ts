import { Code, ConnectError } from "@connectrpc/connect";
import { useEffect } from "react";
import { toast } from "react-hot-toast";
import useNavigateTo from "@/hooks/useNavigateTo";
import { AUTH_REASON_PROTECTED_MEMO, redirectOnAuthFailure } from "@/utils/auth-redirect";

interface UseMemoDetailErrorOptions {
  error: Error | null;
  pathname: string;
  search: string;
  hash: string;
}

const useMemoDetailError = ({ error, pathname, search, hash }: UseMemoDetailErrorOptions) => {
  const navigateTo = useNavigateTo();

  useEffect(() => {
    if (!error) {
      return;
    }

    if (error instanceof ConnectError) {
      if (error.code === Code.Unauthenticated) {
        redirectOnAuthFailure(true, {
          redirect: `${pathname}${search}${hash}`,
          reason: AUTH_REASON_PROTECTED_MEMO,
        });
        return;
      }

      if (error.code === Code.PermissionDenied || error.code === Code.NotFound) {
        navigateTo("/404", { replace: true });
        return;
      }

      toast.error(error.message);
      return;
    }

    toast.error(error.message);
  }, [error, hash, pathname, search, navigateTo]);
};

export default useMemoDetailError;
