import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { storeOAuthState, validateOAuthState } from "@/utils/oauth";

describe("oauth state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips the linking user for link flows", async () => {
    const { state } = await storeOAuthState("identity-providers/google", "link", "/settings", "users/alice");

    expect(validateOAuthState(state)).toEqual({
      identityProviderName: "identity-providers/google",
      flowMode: "link",
      returnUrl: "/settings",
      linkingUserName: "users/alice",
      codeVerifier: expect.any(String),
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
});
