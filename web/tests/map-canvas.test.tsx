import { create } from "@bufbuild/protobuf";
import { render } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapCanvas } from "@/components/MapView/MapCanvas";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const map = vi.hoisted(() => ({
  getContainer: vi.fn(),
  invalidateSize: vi.fn(),
  getCenter: () => ({ wrap: () => ({ lat: 35, lng: 135 }) }),
  getZoom: () => 12,
  getSize: () => ({ x: 1000, y: 800 }),
  latLngToContainerPoint: () => ({ x: 800, y: 400 }),
  setView: vi.fn(),
  fitBounds: vi.fn(),
  panBy: vi.fn(),
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => children,
  Marker: () => null,
  useMap: () => map,
  useMapEvents: () => map,
}));
vi.mock("react-leaflet-cluster", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/map/map-utils", () => ({
  createMarkerIcon: () => ({}),
  MinimalAttributionControl: () => null,
}));

vi.mock("@/components/map/BasemapLayer", () => ({ BasemapLayer: () => null }));

beforeEach(() => {
  map.getContainer.mockReturnValue(document.createElement("div"));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const memo = create(MemoSchema, { name: "memos/selected", location: { latitude: 35, longitude: 135 } });
function props(): ComponentProps<typeof MapCanvas> {
  return {
    memos: [],
    selected: [],
    complete: false,
    desktop: true,
    panelSize: { width: 0, height: 0 },
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
    onMove: vi.fn(),
    onReady: vi.fn(),
    onTileError: vi.fn(),
  };
}

describe("map viewport", () => {
  it("reveals a deep-linked marker when its page arrives without changing zoom", () => {
    const initial = {
      ...props(),
      viewport: { lat: 35, lng: 135, zoom: 12 },
      selected: [memo.name],
      panelSize: { width: 400, height: 776 },
    };
    const { rerender } = render(<MapCanvas {...initial} />);
    expect(map.panBy).not.toHaveBeenCalled();
    rerender(<MapCanvas {...initial} memos={[memo]} complete />);
    expect(map.panBy).toHaveBeenCalledWith([240, 0], { animate: false });
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
  });
  it("fits once after complete loading and never refits on a later refresh or panel change", () => {
    const initial = props();
    const { rerender } = render(<MapCanvas {...initial} memos={[memo]} />);
    expect(map.fitBounds).not.toHaveBeenCalled();
    rerender(<MapCanvas {...initial} memos={[memo]} complete />);
    expect(map.fitBounds).toHaveBeenCalledOnce();
    rerender(
      <MapCanvas {...initial} memos={[memo, { ...memo, name: "memos/another" }]} complete panelSize={{ width: 400, height: 776 }} />,
    );
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });
});
