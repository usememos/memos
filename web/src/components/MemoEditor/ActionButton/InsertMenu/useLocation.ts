import { LatLng } from "leaflet";
import { useState } from "react";
import { Location } from "@/types/proto/api/v1/memo_service";
import { LocationState } from "./types";

export const useLocation = (initialLocation?: Location) => {
  const [locationInitialized, setLocationInitialized] = useState(false);
  const [state, setState] = useState<LocationState>({
    placeholder: initialLocation?.placeholder || "",
    position: initialLocation ? new LatLng(initialLocation.latitude, initialLocation.longitude) : undefined,
    latInput: initialLocation ? String(initialLocation.latitude) : "",
    lngInput: initialLocation ? String(initialLocation.longitude) : "",
  });

  const updatePosition = (position?: LatLng) => {
    setState((prev) => ({
      ...prev,
      position,
      latInput: position ? String(position.lat) : "",
      lngInput: position ? String(position.lng) : "",
    }));
  };

  const handlePositionChange = (position: LatLng) => {
    if (!locationInitialized) {
      setLocationInitialized(true);
    }
    updatePosition(position);
  };

  const handleLatChange = (value: string) => {
    setState((prev) => ({ ...prev, latInput: value }));
    const lat = parseFloat(value);
    if (!isNaN(lat) && lat >= -90 && lat <= 90 && state.position) {
      updatePosition(new LatLng(lat, state.position.lng));
    }
  };

  const handleLngChange = (value: string) => {
    setState((prev) => ({ ...prev, lngInput: value }));
    const lng = parseFloat(value);
    if (!isNaN(lng) && lng >= -180 && lng <= 180 && state.position) {
      updatePosition(new LatLng(state.position.lat, lng));
    }
  };

  const setPlaceholder = (placeholder: string) => {
    setState((prev) => ({ ...prev, placeholder }));
  };

  const reset = () => {
    setState({
      placeholder: "",
      position: undefined,
      latInput: "",
      lngInput: "",
    });
    setLocationInitialized(false);
  };

  const getLocation = (): Location | undefined => {
    if (!state.position || !state.placeholder.trim()) {
      return undefined;
    }
    return Location.fromPartial({
      latitude: state.position.lat,
      longitude: state.position.lng,
      placeholder: state.placeholder,
    });
  };

  return {
    state,
    locationInitialized,
    handlePositionChange,
    handleLatChange,
    handleLngChange,
    setPlaceholder,
    reset,
    getLocation,
  };
};
