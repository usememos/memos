import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "@/pages/AuthCallback";
import { storeOAuthState } from "@/utils/oauth";

const mocks = vi.hoisted(() => ({ initialize: vi.fn(), signIn: vi.fn(), navigateTo: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ initialize: mocks.initialize, isInitialized: true }) }));
vi.mock("@/connect", () => ({ authServiceClient: { signIn: mocks.signIn }, userServiceClient: {} }));
vi.mock("@/auth-state", () => ({ clearAccessToken: vi.fn(), setAccessToken: vi.fn() }));
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => mocks.navigateTo }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const renderCallback = (search: string) =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/auth/callback?${search}`]}>
        <AuthCallback />
      </MemoryRouter>
    </StrictMode>,
  );
const expectRecovery = async (redirect?: string) => {
  const link = await screen.findByRole("link", { name: "auth.back-to-sign-in" });
  const url = new URL(link.getAttribute("href")!, "http://localhost");
  expect(url.pathname).toBe("/auth");
  expect(url.searchParams.get("auto_sign_in")).toBe("false");
  expect(url.searchParams.get("redirect")).toBe(redirect ?? null);
};

describe("SSO callback recovery", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("offers manual recovery after cancellation while retaining the validated destination", async () => {
    const { state } = await storeOAuthState("identityProviders/company", "signin", "/memos/example#comment");
    renderCallback(`error=access_denied&state=${state}`);
    await expectRecovery("/memos/example#comment");
    expect(screen.getByRole("alert")).toHaveTextContent("access_denied");
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("oauth_state")).toBeNull();
  });

  it("does not trust the return path when cancellation state does not match", async () => {
    await storeOAuthState("identityProviders/company", "signin", "/memos/example");
    renderCallback("error=access_denied&state=wrong");
    await expectRecovery();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("offers manual recovery when authorization code or state is missing", async () => {
    renderCallback("code=example");
    await expectRecovery();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("retains the destination after the sign-in RPC fails without retrying", async () => {
    const { state } = await storeOAuthState("identityProviders/company", "signin", "/memos/example");
    mocks.signIn.mockRejectedValueOnce(new Error("Provider unavailable"));
    renderCallback(`code=example&state=${state}`);
    await expectRecovery("/memos/example");
    expect(mocks.signIn).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Provider unavailable");
  });

  it("completes a successful callback once and returns to the requested destination", async () => {
    const { state } = await storeOAuthState("identityProviders/company", "signin", "/memos/example");
    mocks.signIn.mockResolvedValueOnce({});
    renderCallback(`code=example&state=${state}`);
    await waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith("/memos/example"));
    expect(mocks.signIn).toHaveBeenCalledOnce();
    expect(mocks.signIn).toHaveBeenCalledWith({
      credentials: {
        case: "ssoCredentials",
        value: {
          identityProvider: "identityProviders/company",
          code: "example",
          redirectUri: `${window.location.origin}/auth/callback`,
          codeVerifier: expect.any(String),
        },
      },
    });
  });
});
