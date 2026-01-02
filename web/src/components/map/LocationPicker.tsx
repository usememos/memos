import L, { LatLng } from "leaflet";
import { ExternalLinkIcon, MinusIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { cn } from "@/lib/utils";
import { defaultMarkerIcon, ThemedTileLayer } from "./map-utils";

interface MarkerProps {
  position: LatLng | undefined;
  onChange: (position: LatLng) => void;
  readonly?: boolean;
}

const LocationMarker = (props: MarkerProps) => {
  const [position, setPosition] = useState(props.position);
  const initializedRef = useRef(false);

  const map = useMapEvents({
    click(e) {
      if (props.readonly) {
        return;
      }

      setPosition(e.latlng);
      map.locate();
      // Call the parent onChange function.
      props.onChange(e.latlng);
    },
    locationfound() {},
  });

  useEffect(() => {
    if (!initializedRef.current) {
      map.locate();
      initializedRef.current = true;
    }
  }, [map]);

  // Keep marker and map in sync with external position updates
  useEffect(() => {
    if (props.position) {
      setPosition(props.position);
      map.setView(props.position);
    } else {
      setPosition(undefined);
    }
  }, [props.position, map]);

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
        "bg-white/80 backdrop-blur-md border border-white/30 shadow-lg",
        "hover:bg-white/90 hover:scale-105 active:scale-95",
        "dark:bg-black/80 dark:border-white/10 dark:hover:bg-black/90",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
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
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);

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

    // Get container and render React component into it
    const container = control.getContainer();
    if (container) {
      rootRef.current = createRoot(container);
      rootRef.current.render(
        <ControlButtons position={position} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onOpenGoogleMaps={handleOpenInGoogleMaps} />,
      );
    }

    return () => {
      // Cleanup: unmount React component and remove control
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      if (controlRef.current) {
        controlRef.current.remove();
        controlRef.current = null;
      }
    };
  }, [map]);

  // Update rendered content when position changes
  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.render(
        <ControlButtons position={position} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onOpenGoogleMaps={handleOpenInGoogleMaps} />,
      );
    }
  }, [position]);

  return null;
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

interface MapProps {
  readonly?: boolean;
  latlng?: LatLng;
  onChange?: (position: LatLng) => void;
}

const DEFAULT_CENTER_LAT_LNG = new LatLng(48.8584, 2.2945);

const LeafletMap = (props: MapProps) => {
  const position = props.latlng || DEFAULT_CENTER_LAT_LNG;

  return (
    <MapContainer
      className="w-full h-72"
      center={position}
      zoom={13}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
    >
      <ThemedTileLayer />
      <LocationMarker position={position} readonly={props.readonly} onChange={props.onChange ? props.onChange : () => {}} />
      <MapControls position={props.latlng} />
      <MapCleanup />
    </MapContainer>
  );
};

export default LeafletMap;
