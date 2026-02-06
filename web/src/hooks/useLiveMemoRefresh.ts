import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getAccessToken } from "@/auth-state";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";

/**
 * Reconnection parameters for SSE connection.
 */
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const RETRY_BACKOFF_MULTIPLIER = 2;

/**
 * useLiveMemoRefresh connects to the server's SSE endpoint and
 * invalidates relevant React Query caches when memo change events
 * (created, updated, deleted) are received.
 *
 * This enables real-time updates across all open instances of the app.
 */
export function useLiveMemoRefresh() {
  const queryClient = useQueryClient();
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (!mounted) return;

      const token = getAccessToken();
      if (!token) {
        // Not logged in; retry after a delay in case the user logs in.
        retryTimeout = setTimeout(connect, 5000);
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch("/api/v1/sse", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
          credentials: "include",
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        // Successfully connected - reset retry delay.
        retryDelayRef.current = INITIAL_RETRY_DELAY_MS;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (mounted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (separated by double newlines).
          const messages = buffer.split("\n\n");
          // Keep the last incomplete chunk in the buffer.
          buffer = messages.pop() || "";

          for (const message of messages) {
            if (!message.trim()) continue;

            // Parse SSE format: lines starting with "data: " contain JSON payload.
            // Lines starting with ":" are comments (heartbeats).
            for (const line of message.split("\n")) {
              if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6);
                try {
                  const event = JSON.parse(jsonStr) as { type: string; name: string };
                  handleSSEEvent(event, queryClient);
                } catch {
                  // Ignore malformed JSON.
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Intentional abort, don't reconnect.
          return;
        }
        // Connection lost or failed - reconnect with backoff.
      }

      // Reconnect with exponential backoff.
      if (mounted) {
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * RETRY_BACKOFF_MULTIPLIER, MAX_RETRY_DELAY_MS);
        retryTimeout = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [queryClient]);
}

interface SSEChangeEvent {
  type: string;
  name: string;
}

function handleSSEEvent(event: SSEChangeEvent, queryClient: ReturnType<typeof useQueryClient>) {
  switch (event.type) {
    case "memo.created":
      // Invalidate memo lists so new memos appear.
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats (memo count changed).
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      break;

    case "memo.updated":
      // Invalidate the specific memo detail cache.
      queryClient.invalidateQueries({ queryKey: memoKeys.detail(event.name) });
      // Invalidate memo lists to reflect updated content/ordering.
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      break;

    case "memo.deleted":
      // Remove the specific memo from cache.
      queryClient.removeQueries({ queryKey: memoKeys.detail(event.name) });
      // Invalidate memo lists.
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats (memo count changed).
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      break;

    case "reaction.upserted":
    case "reaction.deleted":
      // Reactions are embedded in the memo object, so invalidate the memo detail
      // and lists to reflect the updated reaction state.
      queryClient.invalidateQueries({ queryKey: memoKeys.detail(event.name) });
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      break;
  }
}
