import type { MapPoint } from "@/components/map/types";

export interface LocationState {
  placeholder: string;
  position?: MapPoint;
  latInput: string;
  lngInput: string;
}
