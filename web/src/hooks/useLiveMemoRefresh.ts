import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getRequestToken, refreshAccessToken } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";

/**
 * Reconnection parameters for SSE connection.
 */
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const RETRY_BACKOFF_MULTIPLIER = 2;

const SSE_EVENT_TYPES = {
  memoCreated: "memo.created",
  memoUpdated: "memo.updated",
  memoDeleted: "memo.deleted",
  memoCommentCreated: "memo.comment.created",
  reactionUpserted: "reaction.upserted",
  reactionDeleted: "reaction.deleted",
} as const;

// ---------------------------------------------------------------------------
// Shared connection status store (singleton)
// ---------------------------------------------------------------------------

export type SSEConnectionStatus = "connected" | "disconnected" | "connecting";

type Listener = () => void;

let _status: SSEConnectionStatus = "disconnected";
const _listeners = new Set<Listener>();

function getSSEStatus(): SSEConnectionStatus {
  return _status;
}

function setSSEStatus(s: SSEConnectionStatus) {
  if (_status !== s) {
    _status = s;
    _listeners.forEach((l) => l());
  }
}

function subscribeSSEStatus(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * React hook that returns the current SSE connection status.
 * Re-renders the component whenever the status changes.
 */
export function useSSEConnectionStatus(): SSEConnectionStatus {
  return useSyncExternalStore(subscribeSSEStatus, getSSEStatus, getSSEStatus);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

/**
 * useLiveMemoRefresh connects to the server's SSE endpoint and
 * invalidates relevant React Query caches when change events
 * (memos, reactions) are received.
 *
 * This enables real-time updates across all open instances of the app.
 */
export function useLiveMemoRefresh() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasConnectedOnceRef = useRef(false);

  const currentUserName = currentUser?.name;
  const handleEvent = useCallback((event: SSEChangeEvent) => handleSSEEvent(event, queryClient), [queryClient]);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (!mounted) return;

      if (!currentUserName) {
        setSSEStatus("disconnected");
        return;
      }

      let token = await getRequestToken();
      if (!token) {
        setSSEStatus("disconnected");
        // Not logged in; do not retry. Effect will re-run when currentUser is set.
        return;
      }

      setSSEStatus("connecting");
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        let response = await fetchSSEStream(token, abortController.signal);

        if (response.status === 401) {
          await refreshAccessToken();
          token = await getRequestToken();
          if (!token) {
            throw new Error("SSE connection failed: missing token after refresh");
          }
          response = await fetchSSEStream(token, abortController.signal);
        }

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        // Successfully connected - reset retry delay.
        retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
        setSSEStatus("connected");
        if (hasConnectedOnceRef.current) {
          // Resync active collaborative views after reconnect because the server may have
          // dropped events while the client was disconnected or backpressured.
          queryClient.invalidateQueries({ queryKey: memoKeys.all, refetchType: "active" });
          queryClient.invalidateQueries({ queryKey: userKeys.stats(), refetchType: "active" });
        }
        hasConnectedOnceRef.current = true;

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
                  const event = JSON.parse(jsonStr) as SSEChangeEvent;
                  handleEvent(event);
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
          setSSEStatus("disconnected");
          return;
        }
        // Connection lost or failed - reconnect with backoff.
      }

      setSSEStatus("disconnected");

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
      setSSEStatus("disconnected");
      retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [handleEvent, currentUserName]);
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

function fetchSSEStream(token: string, signal: AbortSignal): Promise<Response> {
  return fetch("/api/v1/sse", {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    signal,
    credentials: "include",
  });
}

interface SSEChangeEvent {
  type: (typeof SSE_EVENT_TYPES)[keyof typeof SSE_EVENT_TYPES];
  name: string;
  parent?: string;
}

function handleSSEEvent(event: SSEChangeEvent, queryClient: ReturnType<typeof useQueryClient>) {
  switch (event.type) {
    case SSE_EVENT_TYPES.memoCreated:
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      break;

    case SSE_EVENT_TYPES.memoUpdated:
      queryClient.invalidateQueries({ queryKey: memoKeys.detail(event.name) });
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      if (event.parent) {
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(event.parent) });
      }
      break;

    case SSE_EVENT_TYPES.memoDeleted:
      queryClient.removeQueries({ queryKey: memoKeys.detail(event.name) });
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      break;

    case SSE_EVENT_TYPES.memoCommentCreated:
      queryClient.invalidateQueries({ queryKey: memoKeys.comments(event.name) });
      queryClient.invalidateQueries({ queryKey: memoKeys.detail(event.name) });
      break;

    case SSE_EVENT_TYPES.reactionUpserted:
    case SSE_EVENT_TYPES.reactionDeleted:
      queryClient.invalidateQueries({ queryKey: memoKeys.detail(event.name) });
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      if (event.parent) {
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(event.parent) });
      }
      break;
  }
}
