import { DivIcon, LatLng } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

const markerIcon = new DivIcon({
  className: "border-none",
  html: ReactDOMServer.renderToString(<MapPinIcon size={24} />),
});

interface MarkerProps {
  position: LatLng | undefined;
  onChange: (position: LatLng) => void;
}

const LocationMarker = (props: MarkerProps) => {
  const [position, setPosition] = useState(props.position);

  const map = useMapEvents({
    click(e) {
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
  latlng?: LatLng;
  onChange?: (position: LatLng) => void;
}

const LeafletMap = (props: MapProps) => {
  return (
    <MapContainer className="w-full h-72" center={props.latlng} zoom={13} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <LocationMarker position={props.latlng} onChange={props.onChange ? props.onChange : () => {}} />
    </MapContainer>
  );
};

export default LeafletMap;
