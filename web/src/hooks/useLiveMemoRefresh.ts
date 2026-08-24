import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getRequestToken, refreshAccessToken } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";

/**
 * Reconnection parameters for SSE connection.
 */
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const RETRY_BACKOFF_MULTIPLIER = 2;
const STABLE_CONNECTION_THRESHOLD_MS = 60_000;
const HIDDEN_DISCONNECT_DELAY_MS = 30_000;

const SSE_CONNECTION_LOCK_NAME = "memos-sse-connection";
const SSE_SYNC_CHANNEL_NAME = "memos-sse-sync";

const SSE_EVENT_TYPE = "memo.changed" as const;

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

interface SSEChangeEvent {
  type: typeof SSE_EVENT_TYPE;
}

type SSESyncMessage =
  | { kind: "event"; event: SSEChangeEvent }
  | { kind: "status"; status: SSEConnectionStatus; targetID?: string }
  | { kind: "status-request"; requesterID: string };

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

/**
 * useLiveMemoRefresh connects to the server's SSE endpoint and
 * invalidates memo-backed React Query caches when a change event is received.
 *
 * This enables real-time updates across all open instances of the app.
 */
export function useLiveMemoRefresh() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const hasConnectedOnceRef = useRef(false);

  const currentUserName = currentUser?.name;
  const handleEvent = useCallback((event: SSEChangeEvent) => handleSSEEvent(event, queryClient), [queryClient]);

  useEffect(() => {
    let mounted = true;
    let isLeader = false;
    let leadershipAbortController: AbortController | null = null;
    let hiddenDisconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    const channel = createSSESyncChannel();
    const channelClientID = createSSEChannelClientID();

    const postSyncMessage = (message: SSESyncMessage) => {
      try {
        channel?.postMessage(message);
      } catch {
        // Cross-tab synchronization is a performance optimization. The leader
        // keeps its own live connection if the channel becomes unavailable.
      }
    };

    const publishStatus = (status: SSEConnectionStatus) => {
      setSSEStatus(status);
      postSyncMessage({ kind: "status", status });
    };

    const publishEvent = (event: SSEChangeEvent) => {
      handleEvent(event);
      postSyncMessage({ kind: "event", event });
    };

    const runConnectionLoop = async (signal: AbortSignal) => {
      while (mounted && !signal.aborted) {
        let connectedAt: number | undefined;

        try {
          publishStatus("connecting");

          let token = await getRequestToken();
          if (!token) {
            // Not logged in; do not retry. The effect will re-run if the
            // authenticated user changes.
            publishStatus("disconnected");
            return;
          }

          let response = await fetchSSEStream(token, signal);

          if (response.status === 401) {
            await cancelResponseBody(response);
            await refreshAccessToken();
            token = await getRequestToken();
            if (!token) {
              throw new Error("SSE connection failed: missing token after refresh");
            }
            response = await fetchSSEStream(token, signal);
          }

          if (signal.aborted) {
            await cancelResponseBody(response);
            return;
          }

          if (!response.ok || !response.body) {
            await cancelResponseBody(response);
            throw new Error(`SSE connection failed: ${response.status}`);
          }

          connectedAt = Date.now();
          publishStatus("connected");
          if (hasConnectedOnceRef.current) {
            // Resync active collaborative views after reconnect because the server may have
            // dropped events while the client was disconnected or backpressured.
            invalidateLiveMemoQueries(queryClient);
          }
          hasConnectedOnceRef.current = true;

          await consumeSSEStream(response.body, signal, publishEvent);
        } catch (err: unknown) {
          if (!isAbortError(err)) {
            // Connection lost or failed; retry below with exponential backoff.
          }
        }

        if (connectedAt !== undefined && Date.now() - connectedAt >= STABLE_CONNECTION_THRESHOLD_MS) {
          retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
        }

        if (!mounted || signal.aborted) {
          return;
        }

        publishStatus("disconnected");
        const retryDelay = retryDelayRef.current;
        retryDelayRef.current = Math.min(retryDelay * RETRY_BACKOFF_MULTIPLIER, MAX_RETRY_DELAY_MS);
        await waitForRetry(withFullJitter(retryDelay), signal);
      }
    };

    const startLeadership = () => {
      if (!mounted || leadershipAbortController || !currentUserName || !isPageEligibleForSSE()) {
        return;
      }

      const abortController = new AbortController();
      leadershipAbortController = abortController;

      void runWithSSELeadership(
        abortController.signal,
        async () => {
          // This tab may have become hidden while its lock request was queued.
          if (!isPageEligibleForSSE()) {
            return;
          }
          isLeader = true;
          try {
            await runConnectionLoop(abortController.signal);
          } finally {
            isLeader = false;
          }
        },
        // Without BroadcastChannel, followers could not receive the leader's
        // events, so each visible tab keeps its own connection as a fallback.
        channel !== null,
      )
        .catch((err: unknown) => {
          if (!isAbortError(err)) {
            console.warn("SSE connection coordinator failed", err);
          }
        })
        .finally(() => {
          if (leadershipAbortController === abortController) {
            leadershipAbortController = null;
          }
        });

      postSyncMessage({ kind: "status-request", requesterID: channelClientID });
    };

    const stopLeadership = () => {
      const abortController = leadershipAbortController;
      leadershipAbortController = null;
      abortController?.abort();
      setSSEStatus("disconnected");
    };

    const clearHiddenDisconnectTimeout = () => {
      if (hiddenDisconnectTimeout) {
        clearTimeout(hiddenDisconnectTimeout);
        hiddenDisconnectTimeout = null;
      }
    };

    const reconcilePageState = () => {
      if (document.visibilityState !== "visible") {
        if (!hiddenDisconnectTimeout) {
          hiddenDisconnectTimeout = setTimeout(() => {
            hiddenDisconnectTimeout = null;
            stopLeadership();
          }, HIDDEN_DISCONNECT_DELAY_MS);
        }
        return;
      }

      clearHiddenDisconnectTimeout();
      if (navigator.onLine === false) {
        stopLeadership();
        return;
      }
      startLeadership();
    };

    const handleVisibilityChange = () => reconcilePageState();
    const handleOnline = () => reconcilePageState();
    const handleOffline = () => stopLeadership();
    const handlePageHide = () => {
      clearHiddenDisconnectTimeout();
      stopLeadership();
    };
    const handlePageShow = () => reconcilePageState();
    const handleSyncMessage = (messageEvent: MessageEvent<SSESyncMessage>) => {
      const message = messageEvent.data;
      if (!message || typeof message !== "object") {
        return;
      }

      switch (message.kind) {
        case "event":
          hasConnectedOnceRef.current = true;
          handleEvent(message.event);
          break;
        case "status":
          if (message.targetID && message.targetID !== channelClientID) {
            break;
          }
          if (message.status === "connected") {
            if (hasConnectedOnceRef.current) {
              invalidateLiveMemoQueries(queryClient);
            }
            hasConnectedOnceRef.current = true;
          }
          setSSEStatus(message.status);
          break;
        case "status-request":
          if (isLeader) {
            postSyncMessage({ kind: "status", status: getSSEStatus(), targetID: message.requesterID });
          }
          break;
      }
    };

    channel?.addEventListener("message", handleSyncMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    if (!currentUserName) {
      setSSEStatus("disconnected");
    } else {
      reconcilePageState();
    }

    return () => {
      mounted = false;
      setSSEStatus("disconnected");
      retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
      clearHiddenDisconnectTimeout();
      stopLeadership();
      channel?.removeEventListener("message", handleSyncMessage);
      channel?.close();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [handleEvent, currentUserName]);
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

function createSSESyncChannel(): BroadcastChannel | null {
  // A channel without cross-tab locking would duplicate every event because
  // each tab would still own a connection. Fall back to independent visible
  // tab connections when either coordination primitive is unavailable.
  if (!("locks" in navigator) || !navigator.locks) {
    return null;
  }

  try {
    return new BroadcastChannel(SSE_SYNC_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function createSSEChannelClientID(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isPageEligibleForSSE(): boolean {
  return document.visibilityState === "visible" && navigator.onLine !== false;
}

async function runWithSSELeadership(signal: AbortSignal, task: () => Promise<void>, coordinateAcrossTabs: boolean): Promise<void> {
  const lockManager = "locks" in navigator ? navigator.locks : undefined;
  if (!coordinateAcrossTabs || !lockManager) {
    await task();
    return;
  }

  await lockManager.request(SSE_CONNECTION_LOCK_NAME, { mode: "exclusive", signal }, async (lock) => {
    if (!lock || signal.aborted) {
      return;
    }
    await task();
  });
}

function withFullJitter(delay: number): number {
  return Math.floor(Math.random() * delay);
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handleAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delay);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The connection may already have been closed by the browser.
  }
}

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

async function consumeSSEStream(body: ReadableStream<Uint8Array>, signal: AbortSignal, onEvent: (event: SSEChangeEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const cancelReader = () => {
    void reader.cancel().catch(() => {
      // The stream may already have been closed by the server.
    });
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

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
              onEvent(event);
            } catch {
              // Ignore malformed JSON.
            }
          }
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
}

function handleSSEEvent(event: SSEChangeEvent, queryClient: ReturnType<typeof useQueryClient>) {
  if (event.type !== SSE_EVENT_TYPE) {
    return;
  }
  invalidateLiveMemoQueries(queryClient);
}

function invalidateLiveMemoQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: memoKeys.all, refetchType: "active" });
  queryClient.invalidateQueries({ queryKey: userKeys.stats(), refetchType: "active" });
  queryClient.invalidateQueries({ queryKey: attachmentKeys.lists(), refetchType: "active" });
}
