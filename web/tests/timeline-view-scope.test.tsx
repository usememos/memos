import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { TimelineViewProvider, useLinkPreviewEnabled, useView } from "@/contexts/ViewContext";

const storageKey = "memos-view-setting";
const saved = { timeBasis: "update_time", orderByTimeAsc: true, maxColumns: 3, compactMode: true, linkPreview: false };
const defaults = { timeBasis: "create_time", orderByTimeAsc: false, maxColumns: 1, compactMode: false, linkPreview: true };

function Probe() {
  const { timeBasis, orderByTimeAsc, maxColumns, compactMode } = useView();
  const linkPreview = useLinkPreviewEnabled();
  return <output>{JSON.stringify({ timeBasis, orderByTimeAsc, maxColumns, compactMode, linkPreview })}</output>;
}

function renderRoute(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <TimelineViewProvider>
            <Probe />
          </TimelineViewProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const settings = () => JSON.parse(screen.getByRole("status").textContent ?? "{}");

describe("Timeline display settings scope", () => {
  beforeEach(() => localStorage.setItem(storageKey, JSON.stringify(saved)));

  it.each([
    "/",
    "/explore",
    "/?creator=alice",
    "/spaces/test",
    "/spaces/test/explore",
    "/Spaces/test/Explore/",
  ])("applies saved preferences to %s", (path) => {
    renderRoute(path);
    expect(settings()).toEqual(saved);
  });

  it.each([
    "/calendar",
    "/map",
    "/archived",
    "/attachments",
    "/memos/example",
    "/memos/shares/example",
    "/spaces/test/calendar",
    "/spaces/test/map",
    "/setting",
    "/views",
  ])("keeps %s independent of Timeline preferences", (path) => {
    renderRoute(path);
    expect(settings()).toEqual(defaults);
  });

  it("restores Timeline preferences after visiting another view without overwriting storage", async () => {
    const router = renderRoute("/spaces/test?creator=alice");
    expect(settings()).toEqual(saved);
    await act(() => router.navigate("/spaces/test/calendar?creator=alice"));
    expect(settings()).toEqual(defaults);
    await act(() => router.navigate("/spaces/test?creator=alice"));
    expect(settings()).toEqual(saved);
    expect(JSON.parse(localStorage.getItem(storageKey) ?? "{}")).toEqual(saved);
  });
});
