import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import LocationPicker from "@/components/map/LocationPicker";

const setView = vi.fn();
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const eventMap = { setView };
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
  MapContainer: ({ children, attributionControl }: { children: ReactNode; attributionControl?: boolean }) => (
    <div data-testid="map" data-attribution-control={attributionControl}>
      {children}
    </div>
  ),
  Marker: ({ position, interactive, keyboard }: { position: { lat: number; lng: number }; interactive?: boolean; keyboard?: boolean }) => (
    <div data-testid="marker" data-interactive={interactive} data-keyboard={keyboard}>
      {`${position.lat},${position.lng}`}
    </div>
  ),
  useMap: () => controlMap,
  useMapEvents: () => eventMap,
}));

vi.mock("@/components/map/map-utils", () => ({
  defaultMarkerIcon: {},
  MinimalAttributionControl: () => <div data-testid="attribution" />,
  OpenStreetMapTileLayer: () => <div data-testid="map-layer" />,
}));

describe("LocationPicker", () => {
  it("uses the explicit minimal attribution control", () => {
    const { getByTestId } = render(<LocationPicker />);

    expect(getByTestId("map")).toHaveAttribute("data-attribution-control", "false");
    expect(getByTestId("attribution")).toBeInTheDocument();
    expect(getByTestId("map-layer")).toBeInTheDocument();
  });

  it("does not recenter when rerendered with the same coordinates", () => {
    const { rerender } = render(<LocationPicker latlng={{ lat: 1, lng: 2 }} />);

    expect(setView).toHaveBeenCalledTimes(1);

    rerender(<LocationPicker latlng={{ lat: 1, lng: 2 }} />);

    expect(setView).toHaveBeenCalledTimes(1);

    rerender(<LocationPicker latlng={{ lat: 3, lng: 4 }} />);

    expect(setView).toHaveBeenCalledTimes(2);
  });

  it("does not show a fake marker at the default map center", () => {
    const { queryByTestId, rerender, getByTestId } = render(<LocationPicker />);

    expect(queryByTestId("marker")).not.toBeInTheDocument();

    rerender(<LocationPicker latlng={{ lat: 1, lng: 2 }} />);

    expect(getByTestId("marker")).toHaveTextContent("1,2");
    expect(getByTestId("marker")).toHaveAttribute("data-interactive", "false");
    expect(getByTestId("marker")).toHaveAttribute("data-keyboard", "false");
  });
});
