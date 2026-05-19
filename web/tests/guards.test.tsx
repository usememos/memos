import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useCurrentUser", () => ({
  __esModule: true,
  default: vi.fn(),
}));

import useCurrentUser from "@/hooks/useCurrentUser";
import { LandingRoute, RequireAuthRoute, RequireGuestRoute } from "@/router/guards";

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

  it("redirects unauthenticated users to /auth with the preserved location", () => {
    mockedUseCurrentUser.mockReturnValue(undefined);

    renderAt(
      "/setting?tab=pins#latest",
      <Routes>
        <Route element={<RequireAuthRoute />}>
          <Route path="/setting" element={<div data-testid="protected">secret</div>} />
        </Route>
        <Route path="/auth" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/auth?redirect=%2Fsetting%3Ftab%3Dpins%23latest");
  });
});

describe("RequireGuestRoute", () => {
  it("renders the auth page when no user is present", () => {
    mockedUseCurrentUser.mockReturnValue(undefined);

    renderAt(
      "/auth",
      <Routes>
        <Route element={<RequireGuestRoute />}>
          <Route path="/auth" element={<div data-testid="sign-in">sign in</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByTestId("sign-in")).toHaveTextContent("sign in");
  });

  it("redirects already-authenticated users to / by default", () => {
    mockedUseCurrentUser.mockReturnValue(fakeUser);

    renderAt(
      "/auth",
      <Routes>
        <Route element={<RequireGuestRoute />}>
          <Route path="/auth" element={<div>sign in</div>} />
        </Route>
        <Route path="/" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/");
  });

  it("honours a safe redirect target from the query string", () => {
    mockedUseCurrentUser.mockReturnValue(fakeUser);

    renderAt(
      "/auth?redirect=%2Fsetting",
      <Routes>
        <Route element={<RequireGuestRoute />}>
          <Route path="/auth" element={<div>sign in</div>} />
        </Route>
        <Route path="/setting" element={<LocationProbe />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/setting");
  });

  it("ignores an auth-family redirect target and falls back to /", () => {
    mockedUseCurrentUser.mockReturnValue(fakeUser);

    renderAt(
      "/auth?redirect=%2Fauth%2Fcallback",
      <Routes>
        <Route element={<RequireGuestRoute />}>
          <Route path="/auth" element={<div>sign in</div>} />
        </Route>
        <Route path="/" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/");
  });

  it("ignores an external redirect target and falls back to /", () => {
    mockedUseCurrentUser.mockReturnValue(fakeUser);

    renderAt(
      "/auth?redirect=%2F%2Fevil.example%2Fphish",
      <Routes>
        <Route element={<RequireGuestRoute />}>
          <Route path="/auth" element={<div>sign in</div>} />
        </Route>
        <Route path="/" element={<LocationProbe />} />
      </Routes>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/");
  });
});
