import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestToken: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("@/connect", () => ({
  getRequestToken: mocks.getRequestToken,
  refreshAccessToken: mocks.refreshAccessToken,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { name: "users/test" } }),
}));

vi.mock("@/hooks/useMemoQueries", () => ({
  memoKeys: {
    all: ["memos"],
    lists: () => ["memos", "list"],
    detail: (name: string) => ["memos", "detail", name],
    comments: (name: string) => ["memos", "comments", name],
  },
}));

vi.mock("@/hooks/useUserQueries", () => ({
  userKeys: {
    stats: () => ["users", "stats"],
  },
}));

import { useLiveMemoRefresh } from "@/hooks/useLiveMemoRefresh";

type MessageListener = (event: MessageEvent) => void;

class TestBroadcastChannel {
  static channels = new Map<string, Set<TestBroadcastChannel>>();

  readonly name: string;
  private readonly listeners = new Set<MessageListener>();

  constructor(name: string) {
    this.name = name;
    const peers = TestBroadcastChannel.channels.get(name) ?? new Set<TestBroadcastChannel>();
    peers.add(this);
    TestBroadcastChannel.channels.set(name, peers);
  }

  postMessage(data: unknown): void {
    for (const peer of TestBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer === this) continue;
      queueMicrotask(() => {
        const event = new MessageEvent("message", { data });
        for (const listener of peer.listeners) {
          listener(event);
        }
      });
    }
  }

  addEventListener(type: string, listener: MessageListener): void {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: MessageListener): void {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  close(): void {
    TestBroadcastChannel.channels.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

interface PendingLock {
  callback: (lock: Lock) => Promise<unknown> | unknown;
  name: string;
  onAbort: () => void;
  reject: (reason: unknown) => void;
  resolve: (value: unknown) => void;
  signal?: AbortSignal;
}

class TestLockManager {
  private held = false;
  private readonly queue: PendingLock[] = [];

  request(name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<unknown> | unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const pending: PendingLock = {
        callback: (lock) => callback(lock),
        name,
        onAbort: () => {
          const index = this.queue.indexOf(pending);
          if (index >= 0) {
            this.queue.splice(index, 1);
            reject(new DOMException("The lock request was aborted", "AbortError"));
          }
        },
        reject,
        resolve,
        signal: options.signal,
      };
      options.signal?.addEventListener("abort", pending.onAbort, { once: true });
      this.queue.push(pending);
      this.drain();
    });
  }

  private drain(): void {
    if (this.held) return;

    const pending = this.queue.shift();
    if (!pending) return;
    if (pending.signal?.aborted) {
      pending.reject(new DOMException("The lock request was aborted", "AbortError"));
      this.drain();
      return;
    }

    this.held = true;
    pending.signal?.removeEventListener("abort", pending.onAbort);
    const lock = { mode: "exclusive", name: pending.name } as Lock;
    void Promise.resolve(pending.callback(lock))
      .then(pending.resolve, pending.reject)
      .finally(() => {
        this.held = false;
        this.drain();
      });
  }
}

let visibilityState: DocumentVisibilityState;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function installBrowserState(lockManager?: TestLockManager) {
  vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  });
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: lockManager,
  });
}

async function flushAsyncWork() {
  await act(async () => {
    for (let index = 0; index < 5; index++) {
      await Promise.resolve();
    }
  });
}

describe("useLiveMemoRefresh", () => {
  beforeEach(() => {
    visibilityState = "visible";
    TestBroadcastChannel.channels.clear();
    mocks.getRequestToken.mockResolvedValue("access-token");
    mocks.refreshAccessToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
  });

  it("shares one SSE connection across tabs and broadcasts events to followers", async () => {
    const lockManager = new TestLockManager();
    installBrowserState(lockManager);

    const streamControllers: ReadableStreamDefaultController<Uint8Array>[] = [];
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamControllers.push(controller);
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstClient = createQueryClient();
    const secondClient = createQueryClient();
    const firstInvalidate = vi.spyOn(firstClient, "invalidateQueries");
    const secondInvalidate = vi.spyOn(secondClient, "invalidateQueries");

    const first = renderHook(() => useLiveMemoRefresh(), { wrapper: createWrapper(firstClient) });
    const second = renderHook(() => useLiveMemoRefresh(), { wrapper: createWrapper(secondClient) });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      streamControllers[0].enqueue(new TextEncoder().encode('data: {"type":"memo.created","name":"memos/1"}\n\n'));
    });

    await waitFor(() => {
      expect(firstInvalidate).toHaveBeenCalledWith({ queryKey: ["memos", "list"] });
      expect(secondInvalidate).toHaveBeenCalledWith({ queryKey: ["memos", "list"] });
    });

    first.unmount();
    second.unmount();
  });

  it("keeps the connection during the hidden grace period, then reconnects when visible", async () => {
    vi.useFakeTimers();
    installBrowserState(new TestLockManager());

    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start() {},
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const hook = renderHook(() => useLiveMemoRefresh(), { wrapper: createWrapper(createQueryClient()) });
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal;
    visibilityState = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    act(() => vi.advanceTimersByTime(29_999));
    expect(firstSignal.aborted).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(firstSignal.aborted).toBe(true);

    visibilityState = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    hook.unmount();
  });

  it("keeps backing off when a successful response closes before becoming stable", async () => {
    vi.useFakeTimers();
    installBrowserState();
    vi.spyOn(Math, "random").mockReturnValue(1);

    const fetchMock = vi.fn().mockImplementation(() => new Response(new Uint8Array(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const hook = renderHook(() => useLiveMemoRefresh(), { wrapper: createWrapper(createQueryClient()) });
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    hook.unmount();
  });
});
