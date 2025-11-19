import { DivIcon, LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useOfflineDetection } from "@/hooks/useOfflineDetection";

const markerIcon = new DivIcon({
  className: "relative border-none",
  html: ReactDOMServer.renderToString(<MapPinIcon className="absolute bottom-1/2 -left-1/2" fill="pink" size={24} />),
});

interface MarkerProps {
  position: LatLng | undefined;
  onChange: (position: LatLng) => void;
  readonly?: boolean;
}

const LocationMarker = (props: MarkerProps) => {
  const [position, setPosition] = useState(props.position);

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
    map.attributionControl.setPrefix("");
    map.locate();
  }, []);

  // Keep marker and map in sync with external position updates
  useEffect(() => {
    if (props.position) {
      setPosition(props.position);
      map.setView(props.position);
    } else {
      setPosition(undefined);
    }
  }, [props.position, map]);

  return position === undefined ? null : <Marker position={position} icon={markerIcon}></Marker>;
};

interface MapProps {
  readonly?: boolean;
  latlng?: LatLng;
  onChange?: (position: LatLng) => void;
}

const DEFAULT_CENTER_LAT_LNG = new LatLng(48.8584, 2.2945);

const OfflineMapOverlay = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const overlay = document.createElement("div");
    overlay.className =
      "absolute inset-0 bg-gray-100 dark:bg-zinc-800 bg-opacity-90 dark:bg-opacity-90 flex items-center justify-center z-[1000] pointer-events-none";
    overlay.innerHTML = `
      <div class="text-center p-4">
        <svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
        </svg>
        <p class="text-gray-600 dark:text-gray-300 font-medium">Map tiles unavailable offline</p>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">You can still set coordinates by clicking</p>
      </div>
    `;
    container.appendChild(overlay);

    return () => {
      container.removeChild(overlay);
    };
  }, [map]);

  return null;
};

const LeafletMap = (props: MapProps) => {
  const position = props.latlng || DEFAULT_CENTER_LAT_LNG;
  const isOffline = useOfflineDetection();

  return (
    <MapContainer className="w-full h-72" center={position} zoom={13} scrollWheelZoom={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          tileerror: () => {
            // Silently handle tile loading errors in offline mode
          },
        }}
      />
      {isOffline && <OfflineMapOverlay />}
      <LocationMarker position={position} readonly={props.readonly} onChange={props.onChange ? props.onChange : () => {}} />
    </MapContainer>
  );
};

export default LeafletMap;
