import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient } from "@tanstack/react-query";

// Don't retry requests that failed due to authentication errors.
// The auth interceptor in connect.ts already handles token refresh and request retry.
// If the interceptor still throws Unauthenticated, the session is truly gone and the
// user will be redirected to /auth. A React Query retry would only fire a second
// failed refresh attempt and a second redirect call while navigation is already in progress.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ConnectError && error.code === Code.Unauthenticated) return false;
  return failureCount < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Balanced approach: Fresh enough for collaboration, but reduces unnecessary refetches
      // Individual queries can override with shorter staleTime if needed (e.g., notifications)
      staleTime: 1000 * 30, // 30 seconds (increased from 10s for better performance)
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: shouldRetry,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: shouldRetry,
    },
  },
});
