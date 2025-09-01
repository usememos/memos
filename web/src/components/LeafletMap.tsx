import { DivIcon, LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { userStore } from "@/store";

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

  return position === undefined ? null : <Marker position={position} icon={markerIcon}></Marker>;
};

interface MapProps {
  readonly?: boolean;
  latlng?: LatLng;
  onChange?: (position: LatLng) => void;
}

const DEFAULT_CENTER_LAT_LNG = new LatLng(48.8584, 2.2945);

// Create a mapping for common map tile providers. If the user-supplied mapTileLayerProvider is not in the map, use it directly as the tile layer URL.

const generalSetting = userStore.state.userGeneralSetting;

const LeafletMap = (props: MapProps) => {
  const position = props.latlng || DEFAULT_CENTER_LAT_LNG;
  // Default to OpenStreetMap if not set, otherwise use the set value as the URL
  let tileLayerUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileLayerProvider = generalSetting?.mapTileLayerProvider;
  if (tileLayerProvider && tileLayerProvider.trim() !== "") {
    tileLayerUrl = tileLayerProvider;
  }

  return (
    <MapContainer className="w-full h-72" center={position} zoom={13} scrollWheelZoom={false}>
      <TileLayer url={tileLayerUrl} />
      <LocationMarker position={position} readonly={props.readonly} onChange={props.onChange ? props.onChange : () => {}} />
    </MapContainer>
  );
};

export default LeafletMap;
