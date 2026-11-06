import L, { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLinkIcon, MinusIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { BasemapLayer } from "./BasemapLayer";
import { defaultMarkerIcon, MinimalAttributionControl } from "./map-utils";
import type { MapPoint } from "./types";

const toLatLng = (point: MapPoint): LatLng => new LatLng(point.lat, point.lng);
const fromLatLng = (latlng: LatLng): MapPoint => ({ lat: latlng.lat, lng: latlng.lng });

interface LocationMarkerProps {
  position: LatLng | undefined;
  onChange: (position: MapPoint) => void;
  readonly?: boolean;
}

const LocationMarker = ({ position: initialPosition, onChange, readonly: readOnly }: LocationMarkerProps) => {
  const [position, setPosition] = useState(initialPosition);

  const map = useMapEvents({
    click(e) {
      if (readOnly) {
        return;
      }

      setPosition(e.latlng);
      onChange(fromLatLng(e.latlng));
    },
  });

  useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
      map.setView(initialPosition);
    } else {
      setPosition(undefined);
    }
  }, [initialPosition, map]);

  return position === undefined ? null : (
    <Marker position={position} icon={defaultMarkerIcon} interactive={false} keyboard={false}></Marker>
  );
};

// Reusable glass-style button component
interface GlassButtonProps {
  icon: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  title: string;
}

const GlassButton = ({ icon, onClick, ariaLabel, title }: GlassButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-mu-lg",
        "border border-mu-line/80 bg-mu-canvas/88 text-mu-ink shadow-mu-key backdrop-blur-md",
        "hover:scale-105 hover:bg-mu-canvas hover:shadow-mu-pop active:scale-95",
        "mu-focus",
      )}
    >
      {icon}
    </button>
  );
};

// Container for all map control buttons
interface ControlButtonsProps {
  position: MapPoint | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOpenGoogleMaps: () => void;
}

const ControlButtons = ({ position, onZoomIn, onZoomOut, onOpenGoogleMaps }: ControlButtonsProps) => {
  const t = useTranslate();
  return (
    <div className="flex flex-col gap-1.5">
      {position && (
        <GlassButton
          icon={<ExternalLinkIcon size={16} className="text-mu-ink" />}
          onClick={onOpenGoogleMaps}
          ariaLabel={t("map.open-in-google-maps")}
          title={t("map.open-in-google-maps")}
        />
      )}
      <GlassButton
        icon={<PlusIcon size={16} className="text-mu-ink" />}
        onClick={onZoomIn}
        ariaLabel={t("map.zoom-in")}
        title={t("map.zoom-in")}
      />
      <GlassButton
        icon={<MinusIcon size={16} className="text-mu-ink" />}
        onClick={onZoomOut}
        ariaLabel={t("map.zoom-out")}
        title={t("map.zoom-out")}
      />
    </div>
  );
};

// Custom Leaflet Control class
class MapControlsContainer extends L.Control {
  private container: HTMLDivElement | undefined = undefined;

  onAdd() {
    this.container = L.DomUtil.create("div", "");
    this.container.style.pointerEvents = "auto";

    // Prevent map interactions when clicking controls
    L.DomEvent.disableClickPropagation(this.container);
    L.DomEvent.disableScrollPropagation(this.container);

    return this.container;
  }

  onRemove() {
    this.container = undefined;
  }

  getContainer() {
    return this.container;
  }
}

interface MapControlsProps {
  position: MapPoint | undefined;
}

const MapControls = ({ position }: MapControlsProps) => {
  const map = useMap();
  const controlRef = useRef<MapControlsContainer | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const handleOpenInGoogleMaps = () => {
    if (!position) return;
    const url = `https://www.google.com/maps?q=${position.lat},${position.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  useEffect(() => {
    // Create custom Leaflet control
    const control = new MapControlsContainer({ position: "topright" });
    controlRef.current = control;
    control.addTo(map);
    setContainer(control.getContainer() ?? null);

    return () => {
      if (controlRef.current) {
        controlRef.current.remove();
        controlRef.current = null;
      }
      setContainer(null);
    };
  }, [map]);

  if (!container) {
    return null;
  }

  return createPortal(
    <ControlButtons position={position} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onOpenGoogleMaps={handleOpenInGoogleMaps} />,
    container,
  );
};

const MapCleanup = () => {
  const map = useMap();

  useEffect(() => {
    return () => {
      // Cleanup map instance when component unmounts
      setTimeout(() => {
        if (map) {
          try {
            map.remove();
          } catch {
            // Ignore errors during cleanup
          }
        }
      }, 0);
    };
  }, [map]);

  return null;
};

interface LocationPickerProps {
  readonly?: boolean;
  latlng?: MapPoint;
  onChange?: (position: MapPoint) => void;
  className?: string;
}

const DEFAULT_CENTER: MapPoint = { lat: 48.8584, lng: 2.2945 };
const noopOnLocationChange = () => {};

const LocationPicker = ({ readonly: readOnly = false, latlng, onChange = noopOnLocationChange, className }: LocationPickerProps) => {
  const mapCenter = useMemo(() => toLatLng(latlng ?? DEFAULT_CENTER), [latlng?.lat, latlng?.lng]);
  const markerPosition = latlng ? mapCenter : undefined;
  const t = useTranslate();
  const statusLabel = latlng ? t("common.selected-location") : t("common.choose-location");

  return (
    <div
      className={cn(
        "memo-location-map relative isolate h-72 w-full overflow-hidden rounded-mu-xl border border-mu-line bg-mu-canvas ",
        className,
      )}
    >
      <MapContainer
        className="map-attribution-minimal h-full w-full !bg-mu-well"
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <MinimalAttributionControl />
        <BasemapLayer />
        <LocationMarker position={markerPosition} readonly={readOnly} onChange={onChange} />
        <MapControls position={latlng} />
        <MapCleanup />
      </MapContainer>

      {!readOnly && (
        <div className="pointer-events-none absolute left-3 top-3 z-[450] flex items-center gap-2">
          <div className="rounded-full border border-mu-line bg-mu-canvas/92 px-2.5 py-1 mu-label-sm tracking-[0.02em] text-mu-ink/80 backdrop-blur-sm">
            {statusLabel}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
