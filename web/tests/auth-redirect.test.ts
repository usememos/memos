import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth-state", () => ({
  clearAccessToken: vi.fn(),
}));

import { clearAccessToken } from "@/auth-state";
import { redirectOnAuthFailure } from "@/utils/auth-redirect";

const mockedClearAccessToken = vi.mocked(clearAccessToken);

type NavigationStub = { replace: ReturnType<typeof vi.fn>; href: string };

function installLocation(href: string): NavigationStub {
  const url = new URL(href);
  const replace = vi.fn((next: string) => {
    // Mirror real navigation: update the mutable href on subsequent inspection.
    location.href = new URL(next, url).toString();
  });
  const location: NavigationStub = { replace, href: url.toString() };

  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return location.href;
      },
      set href(value: string) {
        location.href = value;
      },
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      origin: url.origin,
      replace,
    },
  });

  return location;
}

describe("redirectOnAuthFailure", () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("does nothing when the user is already on an /auth page", () => {
    const nav = installLocation("http://localhost/auth?foo=bar");

    redirectOnAuthFailure();

    expect(nav.replace).not.toHaveBeenCalled();
    expect(mockedClearAccessToken).not.toHaveBeenCalled();
  });

  it("does nothing on a public route by default", () => {
    const nav = installLocation("http://localhost/explore");

    redirectOnAuthFailure();

    expect(nav.replace).not.toHaveBeenCalled();
    expect(mockedClearAccessToken).not.toHaveBeenCalled();
  });

  it("clears the token and redirects to /auth on a protected route", () => {
    const nav = installLocation("http://localhost/home?tab=pins#latest");

    redirectOnAuthFailure();

    expect(mockedClearAccessToken).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith("/auth?redirect=%2Fhome%3Ftab%3Dpins%23latest");
  });

  it("honours forceRedirect even on a public route", () => {
    const nav = installLocation("http://localhost/explore");

    redirectOnAuthFailure(true);

    expect(mockedClearAccessToken).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith("/auth?redirect=%2Fexplore");
  });

  it("embeds the reason parameter when provided", () => {
    const nav = installLocation("http://localhost/home");

    redirectOnAuthFailure(false, { reason: "protected-memo" });

    expect(nav.replace).toHaveBeenCalledWith("/auth?redirect=%2Fhome&reason=protected-memo");
  });

  it("prefers an explicitly provided redirect target over the current location", () => {
    const nav = installLocation("http://localhost/home");

    redirectOnAuthFailure(false, { redirect: "/setting" });

    expect(nav.replace).toHaveBeenCalledWith("/auth?redirect=%2Fsetting");
  });

  it("drops an unsafe redirect target silently", () => {
    const nav = installLocation("http://localhost/home");

    redirectOnAuthFailure(false, { redirect: "//evil.example/phish" });

    expect(nav.replace).toHaveBeenCalledWith("/auth");
  });
});
