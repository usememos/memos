import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, @testing-library/react does not auto-register a
// cleanup hook, so unmount rendered trees between tests explicitly. This keeps
// `screen.getByTestId` from seeing DOM from prior tests in the same file.
afterEach(() => {
  cleanup();
});

// ProseMirror probes layout APIs jsdom doesn't implement.
if (typeof document !== "undefined") {
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
  if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  }
}

// jsdom runs with an opaque origin (no URL set), so its built-in localStorage
// implementation throws SecurityError on every access. Install a Map-backed shim
// so any test that touches localStorage directly can call getItem/setItem/removeItem/clear
// without additional per-file setup. Tests that need special behavior (hooks.test.tsx,
// memo-editor-cache.test.ts) override this via Object.defineProperty / vi.stubGlobal.
if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.clear !== "function") {
  let _store = new Map<string, string>();
  const localStorageShim: Storage = {
    get length() {
      return _store.size;
    },
    getItem: (key: string) => _store.get(key) ?? null,
    setItem: (key: string, value: string) => _store.set(key, value),
    removeItem: (key: string) => _store.delete(key),
    clear: () => {
      _store = new Map<string, string>();
    },
    key: (index: number) => Array.from(_store.keys())[index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageShim,
  });
}

// Defensive shim: `@/auth-state` constructs a BroadcastChannel at module load
// to coordinate token refreshes across tabs. jsdom historically has not shipped
// BroadcastChannel, so any future test that transitively imports auth-state
// would otherwise throw. Current tests avoid that import path on purpose, but
// installing the shim keeps authoring new tests frictionless. No-op when jsdom
// already provides an implementation.
if (typeof globalThis.BroadcastChannel === "undefined") {
  class NoopBroadcastChannel {
    readonly name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
      this.name = name;
    }

    postMessage(_data: unknown): void {}

    close(): void {}

    addEventListener(): void {}

    removeEventListener(): void {}

    dispatchEvent(): boolean {
      return true;
    }
  }

  // @ts-expect-error — attach the shim to the global scope for tests.
  globalThis.BroadcastChannel = NoopBroadcastChannel;
}
