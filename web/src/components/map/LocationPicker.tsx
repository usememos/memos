import L, { LatLng } from "leaflet";
import { ExternalLinkIcon, MinusIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { cn } from "@/lib/utils";
import { defaultMarkerIcon, ThemedTileLayer } from "./map-utils";

interface LocationMarkerProps {
  position: LatLng | undefined;
  onChange: (position: LatLng) => void;
  readonly?: boolean;
}

const LocationMarker = ({ position: initialPosition, onChange, readonly: readOnly }: LocationMarkerProps) => {
  const [position, setPosition] = useState(initialPosition);
  const initializedRef = useRef(false);

  const map = useMapEvents({
    click(e) {
      if (readOnly) {
        return;
      }

      setPosition(e.latlng);
      map.locate();
      onChange(e.latlng);
    },
    locationfound() {},
  });

  useEffect(() => {
    if (!initializedRef.current) {
      map.locate();
      initializedRef.current = true;
    }
  }, [map]);

  useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
      map.setView(initialPosition);
    } else {
      setPosition(undefined);
    }
  }, [initialPosition, map]);

  return position === undefined ? null : <Marker position={position} icon={defaultMarkerIcon}></Marker>;
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
        "h-8 w-8 flex items-center justify-center rounded-lg",
        "cursor-pointer transition-all duration-200",
        "border border-border/80 bg-background/88 text-foreground shadow-sm backdrop-blur-md",
        "hover:scale-105 hover:bg-background hover:shadow-md active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-ring/60",
      )}
    >
      {icon}
    </button>
  );
};

// Container for all map control buttons
interface ControlButtonsProps {
  position: LatLng | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOpenGoogleMaps: () => void;
}

const ControlButtons = ({ position, onZoomIn, onZoomOut, onOpenGoogleMaps }: ControlButtonsProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      {position && (
        <GlassButton
          icon={<ExternalLinkIcon size={16} className="text-foreground" />}
          onClick={onOpenGoogleMaps}
          ariaLabel="Open location in Google Maps"
          title="Open in Google Maps"
        />
      )}
      <GlassButton icon={<PlusIcon size={16} className="text-foreground" />} onClick={onZoomIn} ariaLabel="Zoom in" title="Zoom in" />
      <GlassButton icon={<MinusIcon size={16} className="text-foreground" />} onClick={onZoomOut} ariaLabel="Zoom out" title="Zoom out" />
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
  position: LatLng | undefined;
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
  latlng?: LatLng;
  onChange?: (position: LatLng) => void;
  className?: string;
}

const DEFAULT_CENTER_LAT_LNG = new LatLng(48.8584, 2.2945);
const noopOnLocationChange = () => {};

const LocationPicker = ({ readonly: readOnly = false, latlng, onChange = noopOnLocationChange, className }: LocationPickerProps) => {
  const position = latlng || DEFAULT_CENTER_LAT_LNG;
  const statusLabel = readOnly ? "Pinned location" : latlng ? "Selected location" : "Choose a location";

  return (
    <div
      className={cn(
        "memo-location-map relative isolate h-72 w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm",
        className,
      )}
    >
      <MapContainer
        className="h-full w-full !bg-muted"
        center={position}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <ThemedTileLayer />
        <LocationMarker position={position} readonly={readOnly} onChange={onChange} />
        <MapControls position={latlng} />
        <MapCleanup />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[450] flex items-center gap-2">
        <div className="rounded-full border border-border bg-background/92 px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] text-foreground/80 shadow-sm backdrop-blur-sm">
          {statusLabel}
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
