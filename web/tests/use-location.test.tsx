import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useLocation } from "@/components/MemoEditor/hooks/useLocation";

describe("useLocation", () => {
  test("creates a location after manually entering latitude then longitude", () => {
    const { result } = renderHook(() => useLocation());

    act(() => result.current.updateCoordinate("lat", "35.6762"));
    expect(result.current.state.position).toBeUndefined();

    act(() => result.current.updateCoordinate("lng", "139.6503"));
    expect(result.current.state.position).toEqual({ lat: 35.6762, lng: 139.6503 });

    act(() => result.current.setPlaceholder("Tokyo"));
    expect(result.current.getLocation()).toMatchObject({ latitude: 35.6762, longitude: 139.6503, placeholder: "Tokyo" });
  });

  test("creates a location regardless of coordinate input order and clears it for invalid coordinates", () => {
    const { result } = renderHook(() => useLocation());

    act(() => result.current.updateCoordinate("lng", "-74.006"));
    expect(result.current.state.position).toBeUndefined();

    act(() => result.current.updateCoordinate("lat", "40.7128"));
    expect(result.current.state.position).toEqual({ lat: 40.7128, lng: -74.006 });

    act(() => result.current.updateCoordinate("lat", "91"));
    expect(result.current.state.position).toBeUndefined();
  });
});
