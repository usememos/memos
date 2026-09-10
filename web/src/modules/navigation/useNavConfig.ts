/**
 * React Query hook for the navigation config.
 *
 * The single query owns the load-or-seed read path; mutations persist through
 * the controller and write the resolved state back into the query cache so the
 * UI never goes stale across tabs of this app instance.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadOrSeedConfig, type NavConfigState, type PersistResult, persistConfig, resetConfig } from "./controller";
import type { NavConfig } from "./types";

export const navConfigKeys = {
  all: ["nav-config"] as const,
  state: () => [...navConfigKeys.all, "state"] as const,
};

export const useNavConfig = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: navConfigKeys.state(),
    queryFn: loadOrSeedConfig,
    staleTime: 1000 * 30,
    retry: false,
  });

  const state = query.data ?? null;

  const saveMutation = useMutation({
    mutationFn: (next: NavConfig) => persistConfig(next, { config: state?.config ?? null, memoName: state?.memoName ?? null }),
    onSuccess: (result: PersistResult) => {
      queryClient.setQueryData<NavConfigState>(navConfigKeys.state(), {
        config: result.config,
        memoName: result.memoName,
        source: "memo",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetConfig(state?.memoName ?? null),
    onSuccess: (result) => {
      if (result) queryClient.setQueryData<NavConfigState>(navConfigKeys.state(), result);
    },
  });

  return {
    state,
    isLoading: query.isPending,
    isError: query.isError && !state,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
};
