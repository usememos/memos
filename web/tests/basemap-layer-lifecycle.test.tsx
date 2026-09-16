import { MaplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { render, waitFor } from "@testing-library/react";
import L from "leaflet";
import { createRef } from "react";
import { MapContainer } from "react-leaflet";
import { expect, it, vi } from "vitest";
import { BasemapLayer } from "@/components/map/BasemapLayer";

vi.mock("@/hooks/useResolvedTheme", () => ({ useResolvedTheme: () => "default" }));

it("unregisters a failed WebGL layer before leaving the fallback map", async () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const mapRef = createRef<L.Map>();
  const view = render(
    // jsdom does not provide Leaflet's CSS transition proxy.
    <MapContainer ref={mapRef} center={[0, 0]} zoom={2} zoomAnimation={false}>
      <BasemapLayer />
    </MapContainer>,
  );
  const map = mapRef.current!;

  await waitFor(() => {
    expect(getContext).toHaveBeenCalledWith("webgl2", expect.any(Object));
    const layers: L.Layer[] = [];
    map.eachLayer((layer) => layers.push(layer));
    expect(layers.some((layer) => layer instanceof L.TileLayer)).toBe(true);
    expect(layers.some((layer) => layer instanceof MaplibreGL)).toBe(false);
  });
  expect(view.container.querySelector(".leaflet-gl-layer")).toBeNull();
  expect(() => view.unmount()).not.toThrow();
});
