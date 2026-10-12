import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityProvider_Type, IdentityProviderSchema } from "@/types/proto/api/idp_service_pb";
import { validateOAuthState } from "@/utils/oauth";
import { prepareSSOSignIn } from "@/utils/sso";

vi.mock("@/auth-state", () => ({ clearAccessToken: vi.fn() }));
const provider = create(IdentityProviderSchema, {
  name: "identityProviders/company",
  type: IdentityProvider_Type.OAUTH2,
  config: {
    config: {
      case: "oauth2Config",
      value: { authUrl: "https://sso.example.com/authorize?tenant=team", clientId: "client&one", scopes: ["openid", "profile"] },
    },
  },
});

describe("SSO initiation", () => {
  beforeEach(() => sessionStorage.clear());
  it("preserves URL parameters and destination with state and PKCE", async () => {
    const url = new URL(await prepareSSOSignIn(provider, "/memos/example?view=full#comment"));
    expect(url.origin).toBe("https://sso.example.com");
    expect(url.searchParams.get("tenant")).toBe("team");
    expect(url.searchParams.get("client_id")).toBe("client&one");
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/auth/callback`);
    expect(url.searchParams.get("scope")).toBe("openid profile");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = validateOAuthState(url.searchParams.get("state")!);
    expect(state).toMatchObject({
      identityProviderName: provider.name,
      flowMode: "signin",
      returnUrl: "/memos/example?view=full#comment",
      codeVerifier: expect.any(String),
    });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state!.codeVerifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
  });
  it("does not preserve an external return path", async () => {
    const url = new URL(await prepareSSOSignIn(provider, "https://other.example.com"));
    expect(validateOAuthState(url.searchParams.get("state")!)?.returnUrl).toBeUndefined();
  });
  it("rejects incomplete configuration before creating OAuth state", async () => {
    await expect(prepareSSOSignIn(create(IdentityProviderSchema, { type: IdentityProvider_Type.OAUTH2 }))).rejects.toThrow(
      "Identity provider configuration is invalid.",
    );
    expect(sessionStorage.getItem("oauth_state")).toBeNull();
  });
});
