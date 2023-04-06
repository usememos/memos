import { act, renderHook } from "@testing-library/react-hooks";
import useToggle from "@/hooks/useToggle";
import { describe, expect, it } from "vitest";

describe("useToggle", () => {
  it("useToggle should toggle the value to true", () => {
    const { result } = renderHook(() => useToggle());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, toggle] = result.current;
    act(() => {
      toggle();
    });
    expect(result.current[0]).toBe(true);
  });
  it("useToggle should toggle the value to false", () => {
    const { result } = renderHook(() => useToggle(true));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, toggle] = result.current;
    act(() => {
      toggle();
    });
    expect(result.current[0]).toBe(false);
  });
});
