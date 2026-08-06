import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import useSidebarWidth, { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "@/components/AppSidebar/useSidebarWidth";

// The desktop rail's width is a persisted preference that a narrow window may only *cap*,
// never overwrite. That distinction is the whole reason the hook keeps `preferredWidth` and
// the rendered `width` apart, so it is what these tests pin down.

const STORAGE_KEY = "memos-sidebar-width";

// jsdom's default viewport (1024) leaves the 40% share above SIDEBAR_MAX_WIDTH, so the
// ceiling is the absolute one unless a test deliberately narrows the window.
const WIDE_VIEWPORT = 1024;

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
};

const resizeViewportTo = (width: number) => {
  act(() => {
    setViewportWidth(width);
    window.dispatchEvent(new Event("resize"));
  });
};

describe("useSidebarWidth", () => {
  beforeEach(() => {
    localStorage.clear();
    setViewportWidth(WIDE_VIEWPORT);
  });

  it("starts at the default width with nothing stored", () => {
    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(result.current.minWidth).toBe(SIDEBAR_MIN_WIDTH);
    expect(result.current.maxWidth).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("restores a persisted width on the first render", () => {
    localStorage.setItem(STORAGE_KEY, "312");

    const { result } = renderHook(() => useSidebarWidth());

    // Read synchronously in the state initializer, so the stored width is the first painted
    // width rather than a correction applied after the default flashes.
    expect(result.current.width).toBe(312);
  });

  it("persists a committed width", () => {
    const { result } = renderHook(() => useSidebarWidth());

    act(() => result.current.setWidth(320));

    expect(result.current.width).toBe(320);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("320");
  });

  it("clamps a commit below the floor", () => {
    const { result } = renderHook(() => useSidebarWidth());

    act(() => result.current.setWidth(80));

    expect(result.current.width).toBe(SIDEBAR_MIN_WIDTH);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(SIDEBAR_MIN_WIDTH));
  });

  it("clamps a commit above the ceiling", () => {
    const { result } = renderHook(() => useSidebarWidth());

    act(() => result.current.setWidth(900));

    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(SIDEBAR_MAX_WIDTH));
  });

  it("rounds fractional widths, which a drag can produce on a scaled display", () => {
    const { result } = renderHook(() => useSidebarWidth());

    act(() => result.current.setWidth(287.6));

    expect(result.current.width).toBe(288);
  });

  it("caps the rendered width on a narrow window without discarding the preference", () => {
    localStorage.setItem(STORAGE_KEY, String(SIDEBAR_MAX_WIDTH));
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);

    resizeViewportTo(700);

    // 40% of 700, and the stored preference is left alone so it can come back.
    expect(result.current.width).toBe(280);
    expect(result.current.maxWidth).toBe(280);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(SIDEBAR_MAX_WIDTH));
  });

  it("restores the full preference once the window has room again", () => {
    localStorage.setItem(STORAGE_KEY, String(SIDEBAR_MAX_WIDTH));
    const { result } = renderHook(() => useSidebarWidth());

    resizeViewportTo(700);
    expect(result.current.width).toBe(280);

    resizeViewportTo(WIDE_VIEWPORT);
    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("never lets the viewport cap fall below the floor", () => {
    // A window this narrow only renders the mobile sheet, but the ceiling must not invert
    // past the floor and produce a clamp range that cannot be satisfied.
    resizeViewportTo(320);

    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current.maxWidth).toBe(SIDEBAR_MIN_WIDTH);
    expect(result.current.width).toBe(SIDEBAR_MIN_WIDTH);
  });

  it.each([
    ["a non-numeric value", "wide"],
    ["an empty value", ""],
    ["a negative value", "-40"],
  ])("falls back to the default for %s", (_label, stored) => {
    localStorage.setItem(STORAGE_KEY, stored);

    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("raises a stored width that predates the current floor", () => {
    localStorage.setItem(STORAGE_KEY, "120");

    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current.width).toBe(SIDEBAR_MIN_WIDTH);
  });
});
