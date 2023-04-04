import { act, renderHook } from "@testing-library/react-hooks";
import useLoading from "../../src/hooks/useLoading";
import { describe, expect, it } from "vitest";

describe("Testing useLoading hook", () => {
  it("setLoading", () => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setLoading();
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isSucceed).toBe(false);
  });
  it("setFinish", () => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setFinish();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isSucceed).toBe(true);
  });
  it("setError", () => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setError();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFailed).toBe(true);
    expect(result.current.isSucceed).toBe(false);
  });
});
