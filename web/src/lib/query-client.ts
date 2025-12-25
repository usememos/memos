import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Balanced approach: Fresh enough for collaboration, but reduces unnecessary refetches
      // Individual queries can override with shorter staleTime if needed (e.g., notifications)
      staleTime: 1000 * 30, // 30 seconds (increased from 10s for better performance)
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: 1,
    },
  },
});
