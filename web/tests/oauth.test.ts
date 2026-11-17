import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePKCEPair, storeOAuthState, validateOAuthState } from "@/utils/oauth";

describe("oauth state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips the server-minted state and linking user for link flows", () => {
    storeOAuthState("server-state-link", "identity-providers/google", "link", "/settings", "users/alice", "verifier-123");

    expect(validateOAuthState("server-state-link")).toEqual({
      identityProviderName: "identity-providers/google",
      flowMode: "link",
      returnUrl: "/settings",
      linkingUserName: "users/alice",
      codeVerifier: "verifier-123",
    });
  });

  it("defaults older states to signin without a linking user", () => {
    sessionStorage.setItem(
      "oauth_state",
      JSON.stringify({
        state: "legacy-state",
        identityProviderName: "identity-providers/google",
        timestamp: Date.now(),
        returnUrl: "/auth",
      }),
    );

    expect(validateOAuthState("legacy-state")).toEqual({
      identityProviderName: "identity-providers/google",
      flowMode: "signin",
      returnUrl: "/auth",
      linkingUserName: undefined,
      codeVerifier: undefined,
    });
  });

  it("derives the S256 challenge from the generated verifier", async () => {
    const { codeVerifier, codeChallenge } = await generatePKCEPair();

    expect(codeVerifier).toEqual(expect.any(String));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(codeChallenge).toBe(expected);
  });
});
