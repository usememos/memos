import { act, renderHook } from "@testing-library/react-hooks";
import useLoading from "@/hooks/useLoading";
import { describe, expect, it } from "vitest";

describe("useLoading", () => {
  it("setLoading should set the state to loading", () => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setLoading();
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isSucceed).toBe(false);
  });
  it("setFailed should set the state to failed", () => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setFinish();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFailed).toBe(false);
    expect(result.current.isSucceed).toBe(true);
  });
  it("setError should set the state to error", () => {
    const { result } = renderHook(() => useLoading());
    act(() => {
      result.current.setError();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFailed).toBe(true);
    expect(result.current.isSucceed).toBe(false);
  });
});
