import { create } from "@bufbuild/protobuf";
import { useCallback, useEffect, useRef } from "react";
import { memoServiceClient } from "@/grpcweb";
import { instanceStore } from "@/store";
import { State } from "@/types/proto/api/v1/common_pb";
import { ListMemosRequestSchema, Memo } from "@/types/proto/api/v1/memo_service_pb";

interface UseAutoRefreshOptions {
  filter?: string;
  orderBy?: string;
  state?: State;
  enabled?: boolean;
  intervalSeconds: number;
  onRefresh: () => Promise<void>;
}

const shouldSkipRefreshCheck = (isRefreshing: boolean): boolean => {
  if (isRefreshing) return true;
  if (document.hidden) return true;
  if (!navigator.onLine) return true;
  return false;
};

const checkMemoUpdate = (
  latestMemo: Memo | undefined,
  previousUpdateTime: bigint | undefined,
): { shouldRefresh: boolean; newUpdateTime?: bigint } => {
  if (!latestMemo) {
    return { shouldRefresh: false };
  }

  const currentUpdateTime = latestMemo.updateTime?.seconds;

  if (previousUpdateTime === undefined) {
    return { shouldRefresh: false, newUpdateTime: currentUpdateTime };
  }

  const hasNewerMemo = currentUpdateTime !== undefined && currentUpdateTime > previousUpdateTime;
  return {
    shouldRefresh: hasNewerMemo,
    newUpdateTime: currentUpdateTime,
  };
};

const useAutoRefresh = (options: UseAutoRefreshOptions) => {
  const { filter, orderBy, state = State.NORMAL, enabled = true, intervalSeconds, onRefresh } = options;

  const isAutoRefreshDisabled = intervalSeconds === 0;

  const latestUpdateTimeRef = useRef<bigint | undefined>(undefined);
  const isRefreshingRef = useRef(false);

  const optionsRef = useRef({ filter, orderBy, state, onRefresh });
  optionsRef.current = { filter, orderBy, state, onRefresh };

  const checkForUpdates = useCallback(async () => {
    if (shouldSkipRefreshCheck(isRefreshingRef.current)) {
      return;
    }

    const { filter, orderBy, state, onRefresh } = optionsRef.current;

    try {
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, {
          pageSize: 1,
          orderBy: orderBy || "display_time desc",
          filter,
          state,
        }),
      );

      const latestMemo = response.memos[0];
      const { shouldRefresh, newUpdateTime } = checkMemoUpdate(latestMemo, latestUpdateTimeRef.current);

      if (newUpdateTime !== undefined) {
        latestUpdateTimeRef.current = newUpdateTime;
      }

      if (shouldRefresh) {
        isRefreshingRef.current = true;
        try {
          await onRefresh();
        } finally {
          isRefreshingRef.current = false;
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    if (!enabled || isAutoRefreshDisabled) {
      return;
    }

    checkForUpdates();

    const intervalId = setInterval(checkForUpdates, intervalSeconds * 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleOnline = () => checkForUpdates();
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, isAutoRefreshDisabled, intervalSeconds, checkForUpdates]);

  useEffect(() => {
    latestUpdateTimeRef.current = undefined;
  }, [filter, orderBy, state]);
};

export const isExploreAutoRefreshEnabled = (): boolean => {
  return instanceStore.state.generalSetting?.enableExploreAutoRefresh !== false;
};

export default useAutoRefresh;