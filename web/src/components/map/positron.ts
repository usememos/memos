import { MaplibreGL } from "@maplibre/maplibre-gl-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(workerUrl);

class PositronLayer extends MaplibreGL {
  onRemove(map: LeafletMap) {
    // Leaflet registers the layer before WebGL initializes. The bridge's cleanup
    // assumes a renderer exists, so handle failed construction before unregistering.
    if (!this.getMaplibreMap()) {
      this.getContainer()?.remove();
      return this;
    }
    return super.onRemove(map);
  }
}

export function createPositronLayer(style: string) {
  return new PositronLayer({
    style,
    minZoom: -1,
    attributionControl: {
      customAttribution:
        '<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  });
}
