import { act, renderHook } from "@testing-library/react-hooks";
import useToggle from "../../src/hooks/useToggle";
import { describe, expect, it } from "vitest";

describe("useToggle hook", () => {
  it("should toggle the value to true", () => {
    const { result } = renderHook(() => useToggle());
    console.log(result.current);
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
  });
  it("should toggle the value to false", () => {
    const { result } = renderHook(() => useToggle(true));
    console.log(result.current);
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });
});
