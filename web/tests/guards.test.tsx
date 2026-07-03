import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useCurrentUser", () => ({
  __esModule: true,
  default: vi.fn(),
}));

import useCurrentUser from "@/hooks/useCurrentUser";
import { LandingRoute, RequireAuthRoute } from "@/router/guards";

const mockedUseCurrentUser = vi.mocked(useCurrentUser);

// Minimal User-like stand-in — guards only check truthiness on the value.
const fakeUser = { name: "users/steven" } as unknown as ReturnType<typeof useCurrentUser>;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
};

const renderAt = (initialEntry: string, children: ReactNode) =>
  render(<MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>);

describe("LandingRoute", () => {
  it("renders the nested home page for an authenticated visitor at /", () => {
    mockedUseCurrentUser.mockReturnValue(fakeUser);

    renderAt(
      "/",
      <Routes>
        <Route path="/" element={<LandingRoute />}>
          <Route index element={<div data-testid="home">home</div>} />
        </Route>
        <Route path="/explore" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("home")).toHaveTextContent("home");
  });

  it("sends an unauthenticated visitor from the entry to /explore", () => {
    mockedUseCurrentUser.mockReturnValue(undefined);

    renderAt(
      "/",
      <Routes>
        <Route path="/" element={<LandingRoute />}>
          <Route index element={<div data-testid="home">home</div>} />
        </Route>
        <Route path="/explore" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/explore");
  });

  it("preserves the query string and hash when redirecting an unauthenticated visitor", () => {
    // Covers the regression in issue #5846: bookmarks pointing at `/?filter=...`
    // must not drop their params on the trip through the landing redirect.
    mockedUseCurrentUser.mockReturnValue(undefined);

    renderAt(
      "/?filter=tag:work#latest",
      <Routes>
        <Route path="/" element={<LandingRoute />}>
          <Route index element={<div data-testid="home">home</div>} />
        </Route>
        <Route path="/explore" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/explore?filter=tag:work#latest");
  });
});

describe("RequireAuthRoute", () => {
  it("renders the protected content for authenticated users", () => {
    mockedUseCurrentUser.mockReturnValue(fakeUser);

    renderAt(
      "/setting",
      <Routes>
        <Route element={<RequireAuthRoute />}>
          <Route path="/setting" element={<div data-testid="protected">secret</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByTestId("protected")).toHaveTextContent("secret");
  });

  it("triggers a full-page navigation so Cloudflare Access can authenticate", () => {
    mockedUseCurrentUser.mockReturnValue(undefined);
    // jsdom's location.assign isn't spyable; replace location with a stub.
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign },
    });

    renderAt(
      "/setting?tab=pins#latest",
      <Routes>
        <Route element={<RequireAuthRoute />}>
          <Route path="/setting" element={<div data-testid="protected">secret</div>} />
        </Route>
      </Routes>,
    );

    expect(assign).toHaveBeenCalledWith("/setting?tab=pins#latest");
    expect(screen.queryByTestId("protected")).toBeNull();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});
