import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useEffect, useMemo, useRef } from "react";
import ReactDOMServer from "react-dom/server";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { getLocationDisplayText } from "@/components/MemoMetadata/Location/locationHelpers";
import { BasemapLayer } from "@/components/map/BasemapLayer";
import { createMarkerIcon, MinimalAttributionControl } from "@/components/map/map-utils";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { type MapPin, type MapPinFace, type MapViewport, revealOffset } from "./model";

interface Props {
  memos: Memo[];
  /** Each memo's face and label by name; a memo without one shows the plain dot and its place. */
  pins: ReadonlyMap<string, MapPin>;
  selected: string[];
  viewport?: MapViewport;
  complete: boolean;
  desktop: boolean;
  panelSize: { width: number; height: number };
  onSelect: (names: string[]) => void;
  /** A click on bare map, which reads as "put that away" the way it does on a place card. */
  onDismiss: () => void;
  onMove: (viewport: MapViewport) => void;
  onReady: (map: L.Map | null) => void;
  onTileError: () => void;
}

// Positron's own city dots are 4px black; ours are bigger, colored and white-edged so they never blend in.
const markerIcon = createMarkerIcon({ size: 22, dot: 16 });
const selectedIcon = createMarkerIcon({ size: 36, dot: 20, halo: true });
const FACE_EDGE = "border-2 border-white shadow-[0_1px_4px_rgba(15,23,42,0.4)]";

/**
 * A photo or avatar pin, the calendar cell's marks at map scale: a rounded photo square or a
 * round avatar, white-edged like the dot so it never blends into the basemap. Selection grows
 * it and adds the dot's translucent halo. A photo that fails to load leaves the primary fill.
 */
const createFaceIcon = (face: Exclude<MapPinFace, { kind: "dot" }>, selected: boolean): L.DivIcon => {
  const box = selected ? 40 : 28;
  const side = selected ? 30 : 24;
  const html = ReactDOMServer.renderToString(
    <div
      aria-hidden="true"
      className={cn("grid place-items-center", selected && "bg-primary/20", face.kind === "photo" ? "rounded-[11px]" : "rounded-full")}
      style={{ width: box, height: box }}
    >
      {face.kind === "photo" ? (
        <span
          className={cn("block rounded-md bg-primary bg-cover bg-center", FACE_EDGE)}
          style={{ width: side, height: side, backgroundImage: `url(${JSON.stringify(face.url)})` }}
        />
      ) : (
        <UserAvatar className={cn(FACE_EDGE, selected ? "size-[30px]" : "size-6")} avatarUrl={face.avatarUrl} name={face.name} />
      )}
    </div>,
  );
  return L.divIcon({ html, className: "", iconSize: [box, box], iconAnchor: [box / 2, box / 2] });
};

const faceKey = (face: MapPinFace): string =>
  face.kind === "photo" ? `photo:${face.url}` : face.kind === "author" ? `author:${face.avatarUrl ?? ""}:${face.name ?? ""}` : "dot";

export function fitMemos(map: L.Map, memos: Memo[]) {
  if (memos.length)
    map.fitBounds(L.latLngBounds(memos.map((memo) => [memo.location!.latitude, memo.location!.longitude])), {
      padding: [64, 96],
      maxZoom: 15,
    });
}

function MapBehavior(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const initialFit = useRef(Boolean(props.viewport));
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter().wrap();
      latest.current.onMove({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    },
    click: () => latest.current.onDismiss(),
  });
  useEffect(() => {
    props.onReady(map);
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(map.getContainer());
    return () => {
      resize.disconnect();
      props.onReady(null);
    };
  }, [map, props.onReady]);
  useEffect(() => {
    const viewport = props.viewport;
    if (!viewport) return;
    const center = map.getCenter().wrap();
    if (Math.abs(center.lat - viewport.lat) > 0.00002 || Math.abs(center.lng - viewport.lng) > 0.00002 || map.getZoom() !== viewport.zoom) {
      map.setView([viewport.lat, viewport.lng], viewport.zoom, { animate: false });
    }
  }, [map, props.viewport?.lat, props.viewport?.lng, props.viewport?.zoom]);
  useEffect(() => {
    if (!props.complete || initialFit.current) return;
    initialFit.current = true;
    fitMemos(map, props.memos);
  }, [map, props.complete, props.memos]);
  const selectedName = props.selected[0];
  const selectedLocation = props.memos.find((item) => item.name === selectedName)?.location;
  useEffect(() => {
    if (!selectedLocation || !props.panelSize.width) return;
    const point = map.latLngToContainerPoint([selectedLocation.latitude, selectedLocation.longitude]);
    const offset = revealOffset(point, map.getSize(), props.panelSize, props.desktop);
    if (offset[0] || offset[1]) map.panBy(offset, { animate: false });
  }, [
    map,
    selectedName,
    props.panelSize.width,
    props.panelSize.height,
    props.desktop,
    selectedLocation?.latitude,
    selectedLocation?.longitude,
  ]);
  return null;
}

function Markers({ memos, pins, selected, onSelect }: Pick<Props, "memos" | "pins" | "selected" | "onSelect">) {
  const names = useRef(new WeakMap<L.Marker, string>());
  const markers = useRef(new Map<string, L.Marker>());
  const selection = useMemo(() => new Set(selected), [selected]);
  // Identity-stable positions: a fresh tuple per render would make every marker re-enter the cluster tree.
  const points = useMemo(
    () =>
      memos.map((memo) => {
        const pin = pins.get(memo.name);
        return {
          memo,
          position: [memo.location!.latitude, memo.location!.longitude] as [number, number],
          face: pin?.face ?? { kind: "dot" as const },
          label: pin?.label ?? getLocationDisplayText(memo.location!),
        };
      }),
    [memos, pins],
  );
  // One icon per face and state, so a selection change swaps two icons rather than rebuilding every pin.
  const icons = useRef(new Map<string, L.DivIcon>());
  const iconFor = (face: MapPinFace, isSelected: boolean): L.DivIcon => {
    if (face.kind === "dot") return isSelected ? selectedIcon : markerIcon;
    const key = `${faceKey(face)}:${isSelected}`;
    let icon = icons.current.get(key);
    if (!icon) {
      icon = createFaceIcon(face, isSelected);
      icons.current.set(key, icon);
    }
    return icon;
  };
  // Leaflet reads a marker's title only when it is created, and authors resolve after the pins
  // first draw, so a changed label is written to the live marker and to what a re-added one reads.
  useEffect(() => {
    for (const { memo, label } of points) {
      const marker = markers.current.get(memo.name);
      if (!marker || marker.options.title === label) continue;
      marker.options.title = label;
      marker.getElement()?.setAttribute("title", label);
    }
  }, [points]);
  const clusterGroup = useRef<{ refreshClusters(): void } | null>(null);
  useEffect(() => {
    clusterGroup.current?.refreshClusters();
  }, [selection]);
  return (
    <MarkerClusterGroup
      ref={clusterGroup}
      chunkedLoading
      maxClusterRadius={40}
      zoomToBoundsOnClick={false}
      spiderfyOnMaxZoom={false}
      showCoverageOnHover={false}
      iconCreateFunction={(cluster: { getChildCount(): number; getAllChildMarkers(): L.Marker[] }) => {
        const active = cluster.getAllChildMarkers().some((marker) => selection.has(names.current.get(marker) ?? ""));
        return L.divIcon({
          html: `<span class="grid size-7 place-items-center rounded-full border-[1.5px] border-background bg-primary text-primary-foreground text-xs font-medium tabular-nums shadow-[0_1px_3px_rgba(15,23,42,0.35)]${active ? " outline-[4px] outline-primary/20" : ""}">${cluster.getChildCount()}</span>`,
          className: "",
          iconSize: [28, 28],
        });
      }}
      // A cluster is "the notes around here": clicking it opens them for reading instead of zooming
      // to spread the pins apart. Zoom stays with the wheel and the +/− stack.
      onClick={(event: L.LeafletMouseEvent & { layer?: { getAllChildMarkers(): L.Marker[] } }) => {
        if (!event.layer?.getAllChildMarkers) return;
        const children: L.Marker[] = event.layer.getAllChildMarkers();
        onSelect(
          children.flatMap((marker) => {
            const name = names.current.get(marker);
            return name ? [name] : [];
          }),
        );
      }}
    >
      {points.map(({ memo, position, face, label }) => (
        <Marker
          key={memo.name}
          ref={(marker) => {
            if (marker) {
              names.current.set(marker, memo.name);
              markers.current.set(memo.name, marker);
            } else markers.current.delete(memo.name);
          }}
          position={position}
          icon={iconFor(face, selection.has(memo.name))}
          zIndexOffset={selection.has(memo.name) ? 1000 : 0}
          title={label}
          alt={label}
          eventHandlers={{ click: () => onSelect([memo.name]) }}
        />
      ))}
    </MarkerClusterGroup>
  );
}

export function MapCanvas(props: Props) {
  const initial = useRef(props.viewport);
  return (
    <MapContainer
      center={[initial.current?.lat ?? 20, initial.current?.lng ?? 0]}
      zoom={initial.current?.zoom ?? 2}
      maxZoom={19}
      minZoom={0}
      zoomControl={false}
      attributionControl={false}
      className="map-attribution-minimal absolute! inset-0 z-0 !bg-muted"
    >
      <BasemapLayer onTileError={props.onTileError} />
      <MinimalAttributionControl />
      <MapBehavior {...props} />
      <Markers memos={props.memos} pins={props.pins} selected={props.selected} onSelect={props.onSelect} />
    </MapContainer>
  );
}
