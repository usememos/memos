import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMarkerIcon, MinimalAttributionControl, OpenStreetMapTileLayer } from "@/components/map/map-utils";

vi.mock("leaflet", () => ({
  DivIcon: class {
    options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  },
}));

vi.mock("react-leaflet", () => ({
  AttributionControl: ({ prefix }: { prefix: string | false }) => <div data-testid="attribution-control" data-prefix={String(prefix)} />,
  TileLayer: ({ url, attribution, maxZoom }: { url: string; attribution: string; maxZoom: number }) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution} data-max-zoom={maxZoom} />
  ),
}));

describe("OpenStreetMapTileLayer", () => {
  it("uses the standard keyless tile endpoint with the required attribution", () => {
    render(<OpenStreetMapTileLayer />);

    const tileLayer = screen.getByTestId("tile-layer");
    expect(tileLayer).toHaveAttribute("data-url", "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(tileLayer).toHaveAttribute("data-attribution", '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
    expect(tileLayer).toHaveAttribute("data-max-zoom", "19");
  });

  it("removes Leaflet branding from the attribution control", () => {
    render(<MinimalAttributionControl />);

    expect(screen.getByTestId("attribution-control")).toHaveAttribute("data-prefix", "false");
  });

  it("uses a compact location dot instead of an arrow-shaped pin", () => {
    const marker = createMarkerIcon() as unknown as {
      options: {
        html: string;
        iconSize: [number, number];
        iconAnchor: [number, number];
      };
    };

    expect(marker.options.html).not.toContain("<svg");
    expect(marker.options.html).toContain("rounded-full");
    expect(marker.options.iconSize).toEqual([24, 24]);
    expect(marker.options.iconAnchor).toEqual([12, 12]);
  });
});
