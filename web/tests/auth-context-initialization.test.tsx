import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ hasToken: false }));
const clients = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
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
  userServiceClient: {
    listUserSettings: clients.listUserSettings,
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserSetting_EditorSettingSchema } from "@/types/proto/api/user_service_pb";

const Probe = () => {
  const { currentUser, initialize, isInitialized, isUserSettingsInitialized, userEditorSetting, setUserEditorSetting, refetchSettings } =
    useAuth();
  return (
    <div>
      <span data-testid="initialized">{isInitialized ? "yes" : "no"}</span>
      <span data-testid="user-settings-initialized">{isUserSettingsInitialized ? "yes" : "no"}</span>
      <span data-testid="user">{currentUser?.name ?? "none"}</span>
      <span data-testid="auto-focus">{userEditorSetting?.autoFocusMode ? "yes" : "no"}</span>
      <button type="button" onClick={() => setUserEditorSetting(create(UserSetting_EditorSettingSchema, { autoFocusMode: true }))}>
        enable focus
      </button>
      <button type="button" onClick={() => void refetchSettings()}>
        refresh
      </button>
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
    clients.listUserSettings.mockReset();
  });

  it("preserves a local editor change made while settings are loading", async () => {
    let resolveSettings!: (value: { userSettings: [] }) => void;
    authState.hasToken = true;
    clients.getCurrentUser.mockResolvedValue({ user: { name: "users/alice", username: "alice" } });
    clients.listUserSettings.mockImplementation(() => new Promise<{ userSettings: [] }>((resolve) => (resolveSettings = resolve)));
    render(<Probe />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "initialize" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("users/alice"));
    fireEvent.click(screen.getByRole("button", { name: "enable focus" }));
    resolveSettings({ userSettings: [] });
    await waitFor(() => expect(screen.getByTestId("initialized")).toHaveTextContent("yes"));
    expect(screen.getByTestId("auto-focus")).toHaveTextContent("yes");

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "enable focus" }));
    await act(async () => resolveSettings({ userSettings: [] }));
    expect(clients.listUserSettings).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("auto-focus")).toHaveTextContent("yes");
  });

  it("resets full readiness while post-sign-in settings are pending", async () => {
    let resolveSettings!: (value: { userSettings: [] }) => void;
    clients.getCurrentUser.mockResolvedValue({ user: { name: "users/alice", username: "alice" } });
    clients.listUserSettings.mockImplementation(() => new Promise<{ userSettings: [] }>((resolve) => (resolveSettings = resolve)));

    render(<Probe />, { wrapper });

    // Settle the initial unauthenticated pass; this reproduces the state from
    // which PasswordSignInForm and AuthCallback invoke initialize again.
    fireEvent.click(screen.getByRole("button", { name: "initialize" }));
    await waitFor(() => expect(screen.getByTestId("initialized")).toHaveTextContent("yes"));

    authState.hasToken = true;
    fireEvent.click(screen.getByRole("button", { name: "initialize" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("users/alice"));
    expect(screen.getByTestId("initialized")).toHaveTextContent("no");
    expect(screen.getByTestId("user-settings-initialized")).toHaveTextContent("no");

    resolveSettings({ userSettings: [] });
    await waitFor(() => expect(screen.getByTestId("user-settings-initialized")).toHaveTextContent("yes"));
    expect(screen.getByTestId("initialized")).toHaveTextContent("yes");
  });
});
