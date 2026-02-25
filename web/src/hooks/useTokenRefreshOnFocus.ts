import { useEffect } from "react";
import { FOCUS_TOKEN_EXPIRY_BUFFER_MS, getAccessToken, isTokenExpired } from "@/auth-state";

/**
 * Hook that proactively refreshes the access token when the tab becomes visible
 * and the token is expired or expiring soon.
 *
 * This prevents React Query's automatic refetch-on-window-focus from triggering
 * multiple 401 errors when the user returns to the tab after the token has expired.
 *
 * Related issue: https://github.com/usememos/memos/issues/5589
 */
export function useTokenRefreshOnFocus(refreshFn: () => Promise<void>, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = async () => {
      // Only act when tab becomes visible
      if (document.visibilityState !== "visible") {
        return;
      }

      // Only refresh if we have a token
      const token = getAccessToken();
      if (!token) {
        return;
      }

      // Check if token is expired or expiring soon (within 2 minutes)
      // Use a longer buffer than normal requests to be proactive
      if (isTokenExpired(FOCUS_TOKEN_EXPIRY_BUFFER_MS)) {
        try {
          console.debug("[useTokenRefreshOnFocus] Token expired/expiring, refreshing before queries refetch");
          await refreshFn();
          console.debug("[useTokenRefreshOnFocus] Token refreshed successfully");
        } catch (error) {
          // Don't block - let the normal auth interceptor handle it
          // The user will be redirected if refresh fails
          console.error("[useTokenRefreshOnFocus] Failed to refresh token:", error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshFn, enabled]);
}
