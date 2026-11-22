import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  carryOverTimelineCompactMode,
  DEVICE_PREFERENCES_KEY,
  updateDevicePreferences,
  useDevicePreferences,
} from "@/hooks/useDevicePreferences";

describe("device preferences", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to link previews on and everything else off", () => {
    const { result } = renderHook(() => useDevicePreferences());
    expect(result.current).toEqual({ linkPreview: true, doubleClickEdit: false, compactMode: false, includeComments: false });
  });

  it("carries over a compact mode choice saved as a Timeline view option, once", () => {
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify({ linkPreview: false }));
    localStorage.setItem("memos-view-setting", JSON.stringify({ compactMode: true, maxColumns: 1 }));
    carryOverTimelineCompactMode();
    const { result } = renderHook(() => useDevicePreferences());
    expect(result.current).toEqual({ linkPreview: false, doubleClickEdit: false, compactMode: true, includeComments: false });

    // The Timeline options are saved again without it; the copied choice stays.
    localStorage.setItem("memos-view-setting", JSON.stringify({ maxColumns: 2 }));
    carryOverTimelineCompactMode();
    expect(renderHook(() => useDevicePreferences()).result.current.compactMode).toBe(true);

    // A choice made here is never overwritten by the old one.
    act(() => updateDevicePreferences({ compactMode: false }));
    localStorage.setItem("memos-view-setting", JSON.stringify({ compactMode: true }));
    carryOverTimelineCompactMode();
    expect(result.current.compactMode).toBe(false);
  });

  it("carries nothing over when the Timeline options never held compact mode", () => {
    localStorage.setItem("memos-view-setting", JSON.stringify({ maxColumns: 3 }));
    carryOverTimelineCompactMode();
    expect(localStorage.getItem(DEVICE_PREFERENCES_KEY)).toBeNull();
  });

  it("reads saved values and ignores malformed ones", () => {
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify({ linkPreview: false, doubleClickEdit: "yes" }));
    const { result } = renderHook(() => useDevicePreferences());
    expect(result.current).toEqual({ linkPreview: false, doubleClickEdit: false, compactMode: false, includeComments: false });
  });

  it("persists updates and shares them with every reader", () => {
    const first = renderHook(() => useDevicePreferences());
    const second = renderHook(() => useDevicePreferences());
    act(() => updateDevicePreferences({ doubleClickEdit: true, includeComments: true }));
    const expected = { linkPreview: true, doubleClickEdit: true, compactMode: false, includeComments: true };
    expect(first.result.current).toEqual(expected);
    expect(second.result.current).toEqual(expected);
    expect(JSON.parse(localStorage.getItem(DEVICE_PREFERENCES_KEY) ?? "null")).toEqual(expected);
  });
});
