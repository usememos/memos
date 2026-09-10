/**
 * React Query hook for the navigation config.
 *
 * The single query owns the load-or-seed read path; mutations persist through
 * the controller and write the resolved state back into the query cache so the
 * UI never goes stale across tabs of this app instance.
 *
 * Saves are serialised through a ref queue so rapid toggles/drags never run two
 * `persistConfig`s from the same stale `rev` (last-write-wins would drop edits).
 */

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadOrSeedConfig, type NavConfigState, type PersistResult, persistConfig, resetConfig } from "./controller";
import type { NavConfig } from "./types";

export const navConfigKeys = {
  all: ["nav-config"] as const,
  state: () => [...navConfigKeys.all, "state"] as const,
};

export const useNavConfig = () => {
  const queryClient = useQueryClient();
  // Always read the latest query data when a queued save starts.
  const latestStateRef = useRef<NavConfigState | null>(null);

  const query = useQuery({
    queryKey: navConfigKeys.state(),
    queryFn: loadOrSeedConfig,
    staleTime: 1000 * 30,
    retry: false,
  });

  const state = query.data ?? null;
  latestStateRef.current = state;

  const saveMutation = useMutation({
    mutationFn: (next: NavConfig) => {
      const prev = latestStateRef.current;
      return persistConfig(next, { config: prev?.config ?? null, memoName: prev?.memoName ?? null });
    },
    onSuccess: (result: PersistResult) => {
      queryClient.setQueryData<NavConfigState>(navConfigKeys.state(), {
        config: result.config,
        memoName: result.memoName,
        source: "memo",
      });
      latestStateRef.current = { config: result.config, memoName: result.memoName, source: "memo" };
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetConfig(latestStateRef.current?.memoName ?? null),
    onSuccess: (result) => {
      if (result) {
        queryClient.setQueryData<NavConfigState>(navConfigKeys.state(), result);
        latestStateRef.current = result;
      }
    },
  });

  // Chain onto the in-flight save so the next mutation sees the previous result.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const save = useCallback(
    (next: NavConfig) => {
      const run = () => saveMutation.mutateAsync(next);
      const result = saveQueueRef.current.then(run, run);
      saveQueueRef.current = result.catch(() => {});
      return result;
    },
    [saveMutation],
  );

  return {
    state,
    isLoading: query.isPending,
    isError: query.isError && !state,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    save,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
};
