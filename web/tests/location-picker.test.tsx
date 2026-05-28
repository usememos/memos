import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import LocationPicker from "@/components/map/LocationPicker";

const setView = vi.fn();
const locate = vi.fn();
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const eventMap = { setView, locate };
const controlMap = { zoomIn, zoomOut };

vi.mock("leaflet", () => {
  class LatLng {
    lat: number;
    lng: number;

    constructor(lat: number, lng: number) {
      this.lat = lat;
      this.lng = lng;
    }
  }

  class Control {
    addTo() {
      return this;
    }

    remove() {}
  }

  return {
    default: {
      Control,
      DomUtil: {
        create: () => ({ style: {} }),
      },
      DomEvent: {
        disableClickPropagation: () => {},
        disableScrollPropagation: () => {},
      },
    },
    LatLng,
  };
});

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ position }: { position: { lat: number; lng: number } }) => <div data-testid="marker">{`${position.lat},${position.lng}`}</div>,
  useMap: () => controlMap,
  useMapEvents: () => eventMap,
}));

vi.mock("@/components/map/map-utils", () => ({
  defaultMarkerIcon: {},
  ThemedTileLayer: () => <div data-testid="tile-layer" />,
}));

describe("LocationPicker", () => {
  it("does not recenter when rerendered with the same coordinates", () => {
    const { rerender } = render(<LocationPicker latlng={{ lat: 1, lng: 2 }} />);

    expect(setView).toHaveBeenCalledTimes(1);

    rerender(<LocationPicker latlng={{ lat: 1, lng: 2 }} />);

    expect(setView).toHaveBeenCalledTimes(1);

    rerender(<LocationPicker latlng={{ lat: 3, lng: 4 }} />);

    expect(setView).toHaveBeenCalledTimes(2);
  });
});
