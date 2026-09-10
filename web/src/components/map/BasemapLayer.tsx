import type { MaplibreGL } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { isDarkTheme } from "@/utils/theme";
import { OpenStreetMapTileLayer } from "./map-utils";

let positronModule: Promise<typeof import("./positron")> | undefined;

/** OpenFreeMap's quiet basemaps: Positron in light themes, its dark counterpart otherwise. */
const basemapStyle = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;

interface Props {
  onTileError?: () => void;
}

export function BasemapLayer({ onTileError }: Props) {
  const map = useMap();
  const dark = isDarkTheme(useResolvedTheme());
  const darkRef = useRef(dark);
  darkRef.current = dark;
  const layerRef = useRef<MaplibreGL>(undefined);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (fallback) return;
    let cancelled = false;
    let layer: MaplibreGL | undefined;
    const fail = () => {
      if (!cancelled) setFallback(true);
    };
    // Also cover a stalled style request, worker startup, or module download.
    const timeout = window.setTimeout(fail, 15_000);
    let ready = false;
    const loaded = () => {
      ready = true;
      window.clearTimeout(timeout);
    };
    // Only a style that never loads, or a lost GL context, is fatal. MapLibre also reports every
    // failed tile or sprite request here, and those are not a reason to abandon the vector map.
    const failBeforeLoad = (event: unknown) => {
      if (!ready && !(event as { tile?: unknown } | undefined)?.tile) fail();
    };

    positronModule ??= import("./positron");
    void positronModule
      .then(({ createPositronLayer }) => {
        if (cancelled) return;
        try {
          layer = createPositronLayer(basemapStyle(darkRef.current));
          layer.addTo(map);
        } catch {
          // The bridge cannot tear down a layer whose WebGL map never constructed, so drop its container here.
          layer?.getContainer()?.remove();
          layer = undefined;
          fail();
          return;
        }
        layerRef.current = layer;
        const renderer = layer.getMaplibreMap();
        renderer.on("load", loaded);
        renderer.on("error", failBeforeLoad);
        renderer.on("webglcontextlost", fail);
      })
      .catch(fail);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      const renderer = layer?.getMaplibreMap();
      renderer?.off("load", loaded);
      renderer?.off("error", failBeforeLoad);
      renderer?.off("webglcontextlost", fail);
      layer?.remove();
      layerRef.current = undefined;
    };
  }, [map, fallback]);

  // A theme change restyles the live map; MapLibre diffs the styles and keeps its context and tiles.
  useEffect(() => {
    layerRef.current?.getMaplibreMap().setStyle(basemapStyle(dark));
  }, [dark]);

  return fallback ? <OpenStreetMapTileLayer eventHandlers={{ tileerror: () => onTileError?.() }} /> : null;
}
