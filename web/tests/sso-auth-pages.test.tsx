import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdentityProviderButtons from "@/components/IdentityProviderButtons";
import AdminSignIn from "@/pages/AdminSignIn";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import { IdentityProvider_Type, IdentityProviderSchema } from "@/types/proto/api/idp_service_pb";
import { signInWithSSO } from "@/utils/sso";

const mocks = vi.hoisted(() => ({
  instance: {
    generalSetting: { disallowPasswordAuth: true, disallowUserRegistration: false },
    profile: { needsSetup: false },
    profileLoaded: true,
    isInitialized: true,
  },
  providers: { isLoading: false, isSuccess: true, identityProviderList: [] as unknown[] },
}));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => mocks.instance }));
vi.mock("@/hooks/useIdentityProviderQueries", () => ({ useIdentityProviderList: () => mocks.providers }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ initialize: vi.fn() }) }));
vi.mock("@/connect", () => ({ authServiceClient: {}, userServiceClient: {} }));
vi.mock("@/utils/sso", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/utils/sso")>()), signInWithSSO: vi.fn() }));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: { provider: string }) => (params ? `${key}: ${params.provider}` : key),
}));
vi.mock("@/components/AuthFooter", () => ({ default: () => null }));
vi.mock("@/components/PasswordSignInForm", () => ({ default: () => <div>Password form</div> }));
vi.mock("@/components/CredentialFields", () => ({ default: () => null }));
vi.mock("@/components/ChallengeWidget", () => ({ default: () => null }));
const provider = create(IdentityProviderSchema, {
  name: "identityProviders/company",
  title: "Company SSO",
  type: IdentityProvider_Type.OAUTH2,
  config: { config: { case: "oauth2Config", value: { authUrl: "https://sso.example.com/authorize", clientId: "memos" } } },
});
const renderPage = (path = "/auth", element = <SignIn />) => {
  const router = createMemoryRouter([{ path: "*", element }], { initialEntries: [path] });
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return router;
};
describe("automatic SSO auth pages", () => {
  beforeEach(() => {
    mocks.instance.generalSetting = { disallowPasswordAuth: true, disallowUserRegistration: false };
    mocks.instance.profile.needsSetup = false;
    mocks.instance.profileLoaded = true;
    mocks.instance.isInitialized = true;
    mocks.providers.isLoading = false;
    mocks.providers.isSuccess = true;
    mocks.providers.identityProviderList = [provider];
    vi.mocked(signInWithSSO).mockResolvedValue();
  });
  it.each([
    { path: "/auth", element: <SignIn /> },
    { path: "/auth/signup", element: <SignUp /> },
  ])("starts once on $path and replaces the entry with a bypass preserving the destination", async ({ path, element }) => {
    const router = renderPage(`${path}?redirect=%2Fmemos%2Fexample&reason=protected-memo`, element);
    await waitFor(() => expect(signInWithSSO).toHaveBeenCalledOnce());
    expect(signInWithSSO).toHaveBeenCalledWith(provider, "/memos/example");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(new URLSearchParams(router.state.location.search).get("auto_sign_in")).toBe("false");
    expect(new URLSearchParams(router.state.location.search).get("reason")).toBe("protected-memo");
    expect(screen.getByText("auth.redirecting-to-provider: Company SSO")).toBeInTheDocument();
  });
  it.each([
    {
      scenario: "password auth enabled",
      configure: () => {
        mocks.instance.generalSetting.disallowPasswordAuth = false;
      },
    },
    {
      scenario: "multiple providers",
      configure: () => {
        mocks.providers.identityProviderList = [provider, create(IdentityProviderSchema, { ...provider, name: "identityProviders/other" })];
      },
    },
    {
      scenario: "no provider",
      configure: () => {
        mocks.providers.identityProviderList = [];
      },
    },
    {
      scenario: "providers loading",
      configure: () => {
        mocks.providers.isLoading = true;
        mocks.providers.isSuccess = false;
      },
    },
    {
      scenario: "provider refetch failed",
      configure: () => {
        mocks.providers.isSuccess = false;
      },
    },
    {
      scenario: "instance profile failed",
      configure: () => {
        mocks.instance.profileLoaded = false;
      },
    },
    {
      scenario: "instance still initializing",
      configure: () => {
        mocks.instance.isInitialized = false;
      },
    },
    {
      scenario: "setup required",
      configure: () => {
        mocks.instance.profile.needsSetup = true;
      },
    },
    {
      scenario: "invalid provider",
      configure: () => {
        mocks.providers.identityProviderList = [create(IdentityProviderSchema, { type: IdentityProvider_Type.OAUTH2 })];
      },
    },
  ])("does not automatically redirect when $scenario", async ({ configure }) => {
    configure();
    renderPage();
    await act(async () => {});
    expect(signInWithSSO).not.toHaveBeenCalled();
  });
  it("allows existing users to sign in when registration is closed", async () => {
    mocks.instance.generalSetting.disallowUserRegistration = true;
    renderPage();
    await waitFor(() => expect(signInWithSSO).toHaveBeenCalledOnce());
  });
  it("keeps closed sign-up out of automatic SSO", () => {
    mocks.instance.generalSetting.disallowUserRegistration = true;
    renderPage("/auth/signup", <SignUp />);
    expect(screen.getByText("auth.signups-closed-title")).toBeInTheDocument();
    expect(signInWithSSO).not.toHaveBeenCalled();
  });
  it("keeps administrator sign-in out of automatic SSO", () => {
    renderPage("/auth/admin", <AdminSignIn />);
    expect(screen.getByText("Password form")).toBeInTheDocument();
    expect(signInWithSSO).not.toHaveBeenCalled();
  });
  it("honors the bypass while allowing an explicit manual attempt", () => {
    renderPage("/auth?auto_sign_in=false&redirect=%2Fmemos%2Fexample");
    expect(signInWithSSO).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "auth.continue-with: Company SSO" }));
    expect(signInWithSSO).toHaveBeenCalledWith(provider, "/memos/example");
  });
  it("returns to manual controls after initiation fails without automatically retrying", async () => {
    vi.mocked(signInWithSSO).mockRejectedValueOnce(new Error("Storage unavailable"));
    renderPage();
    const button = await screen.findByRole("button", { name: "auth.continue-with: Company SSO" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(signInWithSSO).toHaveBeenCalledOnce();
    fireEvent.click(button);
    expect(signInWithSSO).toHaveBeenCalledTimes(2);
  });
  it("restores manual controls on bfcache Back without another attempt", async () => {
    renderPage("/auth", <IdentityProviderButtons identityProviderList={[provider]} autoSignIn />);
    await waitFor(() => expect(signInWithSSO).toHaveBeenCalledOnce());
    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    expect(screen.getByRole("button", { name: "auth.continue-with: Company SSO" })).toBeEnabled();
    expect(signInWithSSO).toHaveBeenCalledOnce();
  });
});
