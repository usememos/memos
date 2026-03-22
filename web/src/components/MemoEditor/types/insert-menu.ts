import { LatLng } from "leaflet";

export interface LocationState {
  placeholder: string;
  position?: LatLng;
  latInput: string;
  lngInput: string;
}
