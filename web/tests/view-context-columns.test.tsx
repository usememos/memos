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
