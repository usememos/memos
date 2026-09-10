import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveQuickFindSubmission } from "@/components/AppSidebar/QuickFindDialog";
import { getRouteActionPolicy, getSidebarRouteKind } from "@/components/AppSidebar/routes";
import { CalendarHeader } from "@/components/CalendarView/CalendarHeader";
import { resolveMemoDetailOrigin, resolveMemoParentPage } from "@/components/MemoView/navigation";
import Calendar from "@/pages/Calendar";
import { buildCollectionPath, getSpaceSwitchPath, resolveCollectionRoute } from "@/router/routes";
import { SpaceRoute } from "@/router/SpaceRoute";

const state = vi.hoisted(() => ({
  selectedSpaceName: "spaces/a",
  isSpaceReady: false,
  spaceError: null as ConnectError | null,
  retrySpace: vi.fn(),
}));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => state }));
vi.mock("@/utils/i18n", async (original) => ({
  ...(await original<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/components/CalendarView/CalendarView", () => ({ CalendarView: () => <p>calendar content</p> }));

beforeEach(() => {
  state.isSpaceReady = false;
  state.spaceError = null;
  state.retrySpace.mockClear();
});
describe("Space route contract", () => {
  it.each([
    ["/spaces/a", "home"],
    ["/spaces/a/explore", "explore"],
    ["/spaces/a/calendar/2026/09/06", "calendar"],
    ["/spaces/a/attachments", "attachments"],
    ["/spaces/a/archived", "common"],
    ["/spaces/a/unknown", "common"],
  ])("classifies %s as %s", (path, kind) => expect(getSidebarRouteKind(path)).toBe(kind));
  it("does not interpret unknown space routes or encoded slashes as global collections", () => {
    expect(resolveCollectionRoute("/spaces/a/unknown").isCollection).toBe(false);
    expect(resolveCollectionRoute("/spaces/a/archived").spaceName).toBeUndefined();
    expect(resolveCollectionRoute("/spaces/a%2Fb").isCollection).toBe(false);
    expect(resolveCollectionRoute("/spaces/A").spaceName).toBe("spaces/A");
    expect(buildCollectionPath("/calendar/2026/09", "spaces/A")).toBe("/spaces/A/calendar/2026/09");
  });
  it("preserves collection parameters but drops unrelated global page parameters on switching", () => {
    expect(getSpaceSwitchPath({ pathname: "/spaces/a/explore", search: "?filter=tagSearch%3Ax" }, "spaces/b")).toBe(
      "/spaces/b/explore?filter=tagSearch%3Ax",
    );
    expect(getSpaceSwitchPath({ pathname: "/setting", search: "?section=spaces" }, "spaces/b")).toBe("/spaces/b");
  });
  it("searches from calendar and attachments into the same Space Home", () => {
    for (const path of ["/spaces/a/calendar/2026/09", "/spaces/a/attachments"]) {
      expect(resolveQuickFindSubmission(path, "roadmap", [], "text").destination).toBe("/spaces/a?filter=contentSearch%3Aroadmap");
    }
    expect(getRouteActionPolicy("/memos/a").searchDestination).toBe("/");
  });
  it("carries the full calendar origin through a permanent memo link", () => {
    const parentPage = "/spaces/a/calendar/2026/09/06?filter=tagSearch%3Awork";
    expect(
      resolveMemoParentPage({ pathname: "/spaces/a/calendar/2026/09/06", search: "?filter=tagSearch%3Awork", memoName: "memos/x" }),
    ).toBe(parentPage);
    expect(resolveMemoDetailOrigin({ from: parentPage })).toBe(parentPage);
    expect(resolveMemoDetailOrigin(undefined)).toBe("/");
  });
});

describe("Space page availability", () => {
  const setup = () =>
    render(
      <MemoryRouter initialEntries={["/spaces/a"]}>
        <Routes>
          <Route element={<SpaceRoute />}>
            <Route path="/spaces/a" element={<p>space content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  it("withholds content while loading", () => {
    setup();
    expect(screen.queryByText("space content")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("space.loading");
  });
  it("renders content only after membership resolves", () => {
    state.isSpaceReady = true;
    setup();
    expect(screen.getByText("space content")).toBeInTheDocument();
  });
  it.each([Code.NotFound, Code.PermissionDenied])("shows the same unavailable state for code %s", (code) => {
    state.spaceError = new ConnectError("unavailable", code);
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("space.unavailable");
    expect(screen.getByRole("link", { name: "space.back-to-memos" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("space content")).toBeNull();
  });
  it("offers retry for a transient failure", () => {
    state.spaceError = new ConnectError("offline", Code.Unavailable);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "search.retry" }));
    expect(state.retrySpace).toHaveBeenCalledOnce();
  });
});

describe("Space calendar navigation", () => {
  it("keeps Space and filters in month links", () => {
    render(
      <MemoryRouter initialEntries={["/spaces/a/calendar/2026/09?filter=tagSearch%3Awork"]}>
        <CalendarHeader month="2026-09" monthLabel="September 2026" today="2026-09-06" closable />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "common.next-month" })).toHaveAttribute(
      "href",
      "/spaces/a/calendar/2026/10?filter=tagSearch%3Awork",
    );
    expect(screen.getByRole("link", { name: "common.previous-month" })).toHaveAttribute(
      "href",
      "/spaces/a/calendar/2026/08?filter=tagSearch%3Awork",
    );
  });
  it("resolves an incomplete Space calendar address inside the Space", async () => {
    render(
      <MemoryRouter initialEntries={["/spaces/a/calendar?filter=tagSearch%3Awork"]}>
        <Routes>
          <Route path="/spaces/:spaceUid/calendar/:year?/:month?/:day?" element={<Calendar />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("calendar content")).toBeInTheDocument();
  });
});
