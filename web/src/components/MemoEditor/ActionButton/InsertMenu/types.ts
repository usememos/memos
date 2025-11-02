import { LatLng } from "leaflet";
import { Memo } from "@/types/proto/api/v1/memo_service";

export interface LocationState {
  placeholder: string;
  position?: LatLng;
  latInput: string;
  lngInput: string;
}

export interface LinkMemoState {
  searchText: string;
  isFetching: boolean;
  fetchedMemos: Memo[];
}
