import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { memoServiceClient } from "@/connect";
import { memoKeys } from "@/hooks/useMemoQueries";

interface CoverRefreshState {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  updated: number;
  failed: number;
  pages: number;
}

const IDLE_REFRESH: CoverRefreshState = { status: "idle", updated: 0, failed: 0, pages: 0 };

export function useBookmarkCoverRefresh() {
  const queryClient = useQueryClient();
  const [coverRefresh, setCoverRefresh] = useState<CoverRefreshState>(IDLE_REFRESH);
  const active = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  const refreshCovers = async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    let totals = { updated: 0, failed: 0, pages: 0 };
    setCoverRefresh({ ...totals, status: "running" });
    try {
      let pageToken = "";
      do {
        const response = await memoServiceClient.refreshMemoLinkCovers({ pageToken, pageSize: 20 }, { signal: controller.signal });
        totals = {
          updated: totals.updated + response.updatedLinks,
          failed: totals.failed + response.failedLinks,
          pages: totals.pages + 1,
        };
        if (controller.signal.aborted) break;
        setCoverRefresh({ ...totals, status: "running" });
        pageToken = response.nextPageToken;
      } while (pageToken);
      if (active.current === controller) {
        setCoverRefresh({ ...totals, status: controller.signal.aborted ? "cancelled" : "done" });
      }
    } catch {
      if (active.current === controller) {
        if (!controller.signal.aborted) {
          console.error("link cover refresh failed: request_failed");
        }
        setCoverRefresh({ ...totals, status: controller.signal.aborted ? "cancelled" : "error" });
      }
    } finally {
      if (active.current === controller) active.current = null;
      // A failed or aborted page may already have persisted some covers.
      await queryClient.invalidateQueries({ queryKey: memoKeys.all });
    }
  };

  return { coverRefresh, refreshCovers, cancelRefresh: () => active.current?.abort() };
}
