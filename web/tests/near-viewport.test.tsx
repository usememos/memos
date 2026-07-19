import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNearViewport } from "@/hooks/useNearViewport";

let intersectionCallback: IntersectionObserverCallback;
let observerOptions: IntersectionObserverInit | undefined;

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    intersectionCallback = callback;
    observerOptions = options;
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

const Probe = () => {
  const { ref, isNearViewport } = useNearViewport<HTMLDivElement>();
  return <div ref={ref}>{isNearViewport ? "near" : "waiting"}</div>;
};

describe("useNearViewport", () => {
  beforeEach(() => {
    observerOptions = undefined;
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays dormant until the target approaches the viewport", () => {
    render(<Probe />);

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(observerOptions).toEqual({ rootMargin: "400px 0px" });

    act(() => {
      intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(screen.getByText("near")).toBeInTheDocument();
  });
});
