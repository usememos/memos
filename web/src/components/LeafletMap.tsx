import { DivIcon, LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

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
      map.attributionControl.setPrefix("");
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

  return position === undefined ? null : <Marker position={position} icon={markerIcon}></Marker>;
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
    <MapContainer className="w-full h-72" center={position} zoom={13} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LocationMarker position={position} readonly={props.readonly} onChange={props.onChange ? props.onChange : () => {}} />
      <MapCleanup />
    </MapContainer>
  );
};

export default LeafletMap;
