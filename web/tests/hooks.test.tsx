import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedEffect, useLocalStorage } from "@/hooks";

const localStorageMock = (() => {
  let store = new Map<string, string>();
  let shouldThrowOnSet = false;

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (shouldThrowOnSet) {
        throw new Error("localStorage setItem unavailable");
      }

      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store = new Map<string, string>();
    },
    setShouldThrowOnSet: (value: boolean) => {
      shouldThrowOnSet = value;
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageMock,
});

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorageMock.setShouldThrowOnSet(false);
    window.localStorage.clear();
  });

  afterEach(() => {
    localStorageMock.setShouldThrowOnSet(false);
    window.localStorage.clear();
  });

  it("uses the default value when storage is empty", () => {
    const { result } = renderHook(() => useLocalStorage("hook-test-empty", false));

    expect(result.current[0]).toBe(false);
  });

  it("reads and writes JSON values", () => {
    window.localStorage.setItem("hook-test-existing", JSON.stringify(true));

    const { result } = renderHook(() => useLocalStorage("hook-test-existing", false));

    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem("hook-test-existing")).toBe("false");
  });

  it("supports updater functions", () => {
    const { result } = renderHook(() => useLocalStorage("hook-test-updater", false));

    act(() => {
      result.current[1]((current) => !current);
    });

    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem("hook-test-updater")).toBe("true");
  });

  it("falls back to the default value for malformed storage", () => {
    window.localStorage.setItem("hook-test-malformed", "{bad json");

    const { result } = renderHook(() => useLocalStorage("hook-test-malformed", true));

    expect(result.current[0]).toBe(true);
  });

  it("keeps in-memory state when the default object reference changes and persistence is unavailable", () => {
    localStorageMock.setShouldThrowOnSet(true);

    const initialDefaultValue = { enabled: false };
    const updatedValue = { enabled: true };
    const { result, rerender } = renderHook(({ defaultValue }) => useLocalStorage("hook-test-object", defaultValue), {
      initialProps: { defaultValue: initialDefaultValue },
    });

    expect(result.current[0]).toBe(initialDefaultValue);

    act(() => {
      result.current[1](updatedValue);
    });

    expect(result.current[0]).toBe(updatedValue);

    rerender({ defaultValue: { enabled: false } });

    expect(result.current[0]).toBe(updatedValue);
  });
});

describe("useDebouncedEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("runs the latest callback after the delay", () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ value }) => {
        useDebouncedEffect(
          () => {
            calls.push(value);
          },
          100,
          [value],
        );
      },
      { initialProps: { value: "first" } },
    );

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(calls).toEqual([]);

    rerender({ value: "second" });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(calls).toEqual(["second"]);
  });

  it("uses the latest callback when unrelated props rerender before the delay", () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ dependency, value }) => {
        useDebouncedEffect(
          () => {
            calls.push(value);
          },
          100,
          [dependency],
        );
      },
      { initialProps: { dependency: "same", value: "first" } },
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(calls).toEqual([]);

    rerender({ dependency: "same", value: "second" });

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(calls).toEqual(["second"]);
  });

  it("clears the pending timeout on unmount", () => {
    const calls: string[] = [];
    const { unmount } = renderHook(() => {
      useDebouncedEffect(
        () => {
          calls.push("called");
        },
        100,
        [],
      );
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(calls).toEqual([]);
  });
});
