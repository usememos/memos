import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEVICE_PREFERENCES_KEY, updateDevicePreferences, useDevicePreferences } from "@/hooks/useDevicePreferences";

describe("device preferences", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to link previews on and double-click editing off", () => {
    const { result } = renderHook(() => useDevicePreferences());
    expect(result.current).toEqual({ linkPreview: true, doubleClickEdit: false });
  });

  it("reads saved values and ignores malformed ones", () => {
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify({ linkPreview: false, doubleClickEdit: "yes" }));
    const { result } = renderHook(() => useDevicePreferences());
    expect(result.current).toEqual({ linkPreview: false, doubleClickEdit: false });
  });

  it("persists updates and shares them with every reader", () => {
    const first = renderHook(() => useDevicePreferences());
    const second = renderHook(() => useDevicePreferences());
    act(() => updateDevicePreferences({ doubleClickEdit: true }));
    expect(first.result.current).toEqual({ linkPreview: true, doubleClickEdit: true });
    expect(second.result.current).toEqual({ linkPreview: true, doubleClickEdit: true });
    expect(JSON.parse(localStorage.getItem(DEVICE_PREFERENCES_KEY) ?? "null")).toEqual({ linkPreview: true, doubleClickEdit: true });
  });
});
