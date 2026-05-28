import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, @testing-library/react does not auto-register a
// cleanup hook, so unmount rendered trees between tests explicitly. This keeps
// `screen.getByTestId` from seeing DOM from prior tests in the same file.
afterEach(() => {
  cleanup();
});

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
