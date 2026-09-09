import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpaceProvider, useSpaceContext } from "@/contexts/SpaceContext";
import { getSpaceSwitchPath } from "@/router/routes";

const state = vi.hoisted(() => ({
  user: "users/alice",
  spaces: [
    { name: "spaces/a", title: "Same" },
    { name: "spaces/b", title: "Same" },
  ],
  ready: true,
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: state.user }) }));
vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => ({ data: state.spaces, isPending: false, isError: false }),
  useSpace: (_user: string, name?: string) => ({
    data: state.ready ? state.spaces.find((s) => s.name === name) : undefined,
    isSuccess: state.ready,
    error: null,
    refetch: vi.fn(),
  }),
}));
const Probe = () => {
  const location = useLocation();
  const context = useSpaceContext();
  return (
    <>
      <output data-testid="path">{location.pathname + location.search}</output>
      <output data-testid="space">{context.selectedSpaceName || "all"}</output>
      <output data-testid="filter">{context.memoFilter || "all"}</output>
      <output data-testid="ready">{String(context.isSpaceReady)}</output>
      <output data-testid="duplicates">{[...context.duplicateSpaceTitles].join(",")}</output>
      <Link to={getSpaceSwitchPath(location, "spaces/b")}>B</Link>
      <Link to={getSpaceSwitchPath(location)}>Memos</Link>
      <Outlet />
    </>
  );
};
const setup = (path = "/") => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <SpaceProvider>
            <Probe />
          </SpaceProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
};
describe("URL-owned Space context", () => {
  beforeEach(() => {
    state.ready = true;
    state.user = "users/alice";
  });
  it("reads All on global pages", () => {
    setup("/explore");
    expect(screen.getByTestId("space")).toHaveTextContent("all");
    expect(screen.getByTestId("filter")).toHaveTextContent("all");
  });
  it("restores Space from a deep link before metadata has loaded", () => {
    state.ready = false;
    setup("/spaces/a/calendar/2026/09/06");
    expect(screen.getByTestId("space")).toHaveTextContent("spaces/a");
    expect(screen.getByTestId("filter")).toHaveTextContent('space == "spaces/a"');
    expect(screen.getByTestId("ready")).toHaveTextContent("false");
  });
  it("preserves dates and filters through A, B, All and browser history", async () => {
    const suffix = "/calendar/2026/09/06?filter=tagSearch%3Awork";
    const router = setup(`/spaces/a${suffix}`);
    fireEvent.click(screen.getByText("B"));
    expect(screen.getByTestId("path").textContent).toBe(`/spaces/b${suffix}`);
    expect(screen.getByTestId("space")).toHaveTextContent("spaces/b");
    expect(screen.getByTestId("duplicates")).toHaveTextContent("Same");
    fireEvent.click(screen.getByText("Memos"));
    expect(screen.getByTestId("path").textContent).toBe(suffix);
    await act(() => router.navigate(-1));
    expect(screen.getByTestId("space")).toHaveTextContent("spaces/b");
    await act(() => router.navigate(-1));
    expect(screen.getByTestId("space")).toHaveTextContent("spaces/a");
    await act(() => router.navigate(1));
    expect(screen.getByTestId("space")).toHaveTextContent("spaces/b");
  });
  it.each(["/memos/123", "/archived", "/inbox", "/setting", "/u/alice"])("keeps %s global and switches to Space Home", (path) => {
    setup(`${path}?filter=tagSearch%3Awork`);
    expect(screen.getByTestId("space")).toHaveTextContent("all");
    fireEvent.click(screen.getByText("B"));
    expect(screen.getByTestId("path").textContent).toBe("/spaces/b");
  });
});
