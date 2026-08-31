import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useView, ViewProvider } from "@/contexts/ViewContext";

const LOCAL_STORAGE_KEY = "memos-view-setting";

const wrapper = ({ children }: { children: ReactNode }) => <ViewProvider>{children}</ViewProvider>;

const persisted = () => JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? "{}");

describe("ViewContext maxColumns setting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to a single column", () => {
    const { result } = renderHook(() => useView(), { wrapper });
    expect(result.current.maxColumns).toBe(1);
  });

  it("updates and persists the column ceiling", () => {
    const { result } = renderHook(() => useView(), { wrapper });

    act(() => result.current.setMaxColumns(0));

    expect(result.current.maxColumns).toBe(0);
    expect(persisted().maxColumns).toBe(0);
  });

  it("sets and persists the sort direction explicitly", () => {
    const { result } = renderHook(() => useView(), { wrapper });

    act(() => result.current.setOrderByTimeAsc(true));

    expect(result.current.orderByTimeAsc).toBe(true);
    expect(persisted().orderByTimeAsc).toBe(true);
  });

  it("restores a persisted column count on init", () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ maxColumns: 2 }));

    const { result } = renderHook(() => useView(), { wrapper });

    expect(result.current.maxColumns).toBe(2);
  });

  it("falls back to a single column for an invalid persisted value", () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ maxColumns: 7 }));

    const { result } = renderHook(() => useView(), { wrapper });

    expect(result.current.maxColumns).toBe(1);
  });
});

describe("ViewContext layoutMode setting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the flow list", () => {
    const { result } = renderHook(() => useView(), { wrapper });
    expect(result.current.layoutMode).toBe("flow");
  });

  it("updates and persists the mode", () => {
    const { result } = renderHook(() => useView(), { wrapper });

    act(() => result.current.setLayoutMode("bento"));

    expect(result.current.layoutMode).toBe("bento");
    expect(persisted().layoutMode).toBe("bento");
  });

  it("migrates pre-mode settings by column count", () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ maxColumns: 3 }));
    const grid = renderHook(() => useView(), { wrapper });
    expect(grid.result.current.layoutMode).toBe("masonry");
    grid.unmount();

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ maxColumns: 1 }));
    const list = renderHook(() => useView(), { wrapper });
    expect(list.result.current.layoutMode).toBe("flow");
  });

  it("restores an explicit persisted mode", () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ layoutMode: "bento", maxColumns: 2 }));

    const { result } = renderHook(() => useView(), { wrapper });

    expect(result.current.layoutMode).toBe("bento");
    expect(result.current.maxColumns).toBe(2);
  });

  it("falls back to flow for an invalid persisted mode", () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ layoutMode: "diagonal" }));

    const { result } = renderHook(() => useView(), { wrapper });

    expect(result.current.layoutMode).toBe("flow");
  });
});
