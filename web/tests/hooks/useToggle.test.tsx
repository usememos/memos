import { act, renderHook } from "@testing-library/react-hooks";
import useToggle from "@/hooks/useToggle";
import { describe, expect, it } from "vitest";

describe("useToggle", () => {
  it("useToggle should toggle the value to true", () => {
    const { result } = renderHook(() => useToggle());
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
  });
  it("useToggle should toggle the value to false", () => {
    const { result } = renderHook(() => useToggle(true));
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });
});
