import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BasemapLayer } from "@/components/map/BasemapLayer";
import { createPositronLayer } from "@/components/map/positron";

const mocks = vi.hoisted(() => ({
  map: { setView: vi.fn(), fitBounds: vi.fn() },
  create: vi.fn(),
}));

vi.mock("react-leaflet", () => ({ useMap: () => mocks.map }));
vi.mock("@/hooks/useResolvedTheme", () => ({ useResolvedTheme: () => "default" }));
vi.mock("@/components/map/positron", () => ({ createPositronLayer: mocks.create }));
vi.mock("@/components/map/map-utils", () => ({
  OpenStreetMapTileLayer: ({ eventHandlers }: { eventHandlers: { tileerror: () => void } }) => (
    <button type="button" onClick={eventHandlers.tileerror}>
      OSM fallback
    </button>
  ),
}));

describe("BasemapLayer", () => {
  let listeners: Map<string, () => void>;
  let layer: { addTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; getMaplibreMap: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    listeners = new Map();
    layer = {
      addTo: vi.fn(),
      remove: vi.fn(),
      getMaplibreMap: vi.fn(() => ({
        on: (event: string, callback: () => void) => listeners.set(event, callback),
        off: (event: string) => listeners.delete(event),
      })),
    };
    vi.mocked(createPositronLayer).mockReturnValue(layer as unknown as ReturnType<typeof createPositronLayer>);
  });

  afterEach(() => vi.useRealTimers());

  it("loads the vector layer without moving the map and cleans up on unmount", async () => {
    const view = render(<BasemapLayer />);
    await waitFor(() => expect(layer.addTo).toHaveBeenCalledWith(mocks.map));
    expect(screen.queryByText("OSM fallback")).not.toBeInTheDocument();
    expect(mocks.map.setView).not.toHaveBeenCalled();
    expect(mocks.map.fitBounds).not.toHaveBeenCalled();
    view.unmount();
    expect(layer.remove).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });

  it.each(["error", "webglcontextlost"])("falls back on %s without reporting a failure until OSM also fails", async (event) => {
    const onTileError = vi.fn();
    render(<BasemapLayer onTileError={onTileError} />);
    await waitFor(() => expect(listeners.has(event)).toBe(true));
    act(() => listeners.get(event)!());
    expect(layer.remove).toHaveBeenCalledOnce();
    expect(onTileError).not.toHaveBeenCalled();
    act(() => screen.getByRole("button", { name: "OSM fallback" }).click());
    expect(onTileError).toHaveBeenCalledTimes(1);
  });

  it("falls back when WebGL initialization throws", async () => {
    layer.addTo.mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });
    render(<BasemapLayer />);
    expect(await screen.findByText("OSM fallback")).toBeInTheDocument();
    expect(layer.remove).toHaveBeenCalledOnce();
  });

  it("falls back on a stalled load", async () => {
    vi.useFakeTimers();
    render(<BasemapLayer />);
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(screen.getByText("OSM fallback")).toBeInTheDocument();
  });

  it("keeps a loaded vector layer past the initial timeout", async () => {
    vi.useFakeTimers();
    render(<BasemapLayer />);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    act(() => listeners.get("load")!());
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.queryByText("OSM fallback")).not.toBeInTheDocument();
  });

  it("does not attach a late import after unmount", async () => {
    const view = render(<BasemapLayer />);
    view.unmount();
    await act(async () => {});
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("attaches only the active effect's layer in Strict Mode", async () => {
    render(
      <StrictMode>
        <BasemapLayer />
      </StrictMode>,
    );
    await waitFor(() => expect(layer.addTo).toHaveBeenCalledOnce());
  });
});
