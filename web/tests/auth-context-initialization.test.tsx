import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ hasToken: false }));
const clients = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listShortcuts: vi.fn(),
  listUserSettings: vi.fn(),
}));

vi.mock("@/auth-state", () => ({
  clearAccessToken: vi.fn(),
  getAccessToken: () => (authState.hasToken ? "token" : undefined),
}));

vi.mock("@/connect", () => ({
  authServiceClient: {
    getCurrentUser: clients.getCurrentUser,
    signOut: vi.fn(),
  },
  refreshAccessToken: vi.fn(async () => undefined),
  shortcutServiceClient: {
    listShortcuts: clients.listShortcuts,
  },
  userServiceClient: {
    listUserSettings: clients.listUserSettings,
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const Probe = () => {
  const { currentUser, initialize, isInitialized } = useAuth();
  return (
    <div>
      <span data-testid="initialized">{isInitialized ? "yes" : "no"}</span>
      <span data-testid="user">{currentUser?.name ?? "none"}</span>
      <button type="button" onClick={() => void initialize()}>
        initialize
      </button>
    </div>
  );
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("AuthProvider initialization", () => {
  beforeEach(() => {
    authState.hasToken = false;
    clients.getCurrentUser.mockReset();
    clients.listShortcuts.mockReset();
    clients.listUserSettings.mockReset();
  });

  it("resets full readiness while post-sign-in settings are pending", async () => {
    let resolveSettings!: (value: { settings: [] }) => void;
    let resolveShortcuts!: (value: { shortcuts: [] }) => void;
    clients.getCurrentUser.mockResolvedValue({ user: { name: "users/alice", username: "alice" } });
    clients.listUserSettings.mockImplementation(
      () => new Promise<{ settings: [] }>((resolve) => (resolveSettings = resolve)),
    );
    clients.listShortcuts.mockImplementation(
      () => new Promise<{ shortcuts: [] }>((resolve) => (resolveShortcuts = resolve)),
    );

    render(<Probe />, { wrapper });

    // Settle the initial unauthenticated pass; this reproduces the state from
    // which PasswordSignInForm and AuthCallback invoke initialize again.
    fireEvent.click(screen.getByRole("button", { name: "initialize" }));
    await waitFor(() => expect(screen.getByTestId("initialized")).toHaveTextContent("yes"));

    authState.hasToken = true;
    fireEvent.click(screen.getByRole("button", { name: "initialize" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("users/alice"));
    expect(screen.getByTestId("initialized")).toHaveTextContent("no");

    resolveSettings({ settings: [] });
    resolveShortcuts({ shortcuts: [] });
    await waitFor(() => expect(screen.getByTestId("initialized")).toHaveTextContent("yes"));
  });
});
