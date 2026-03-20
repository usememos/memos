import { create } from "@bufbuild/protobuf";
import { LatLng } from "leaflet";
import { useCallback, useMemo, useRef, useState } from "react";
import { Location, LocationSchema } from "@/types/proto/api/v1/memo_service_pb";
import { LocationState } from "../types/insert-menu";

export const useLocation = (initialLocation?: Location) => {
  const [locationInitialized, setLocationInitialized] = useState(false);
  const locationInitializedRef = useRef(locationInitialized);
  locationInitializedRef.current = locationInitialized;

  const [state, setState] = useState<LocationState>({
    placeholder: initialLocation?.placeholder || "",
    position: initialLocation ? new LatLng(initialLocation.latitude, initialLocation.longitude) : undefined,
    latInput: initialLocation ? String(initialLocation.latitude) : "",
    lngInput: initialLocation ? String(initialLocation.longitude) : "",
  });

  // Ref to latest state so getLocation can be stable without closing over state.
  const stateRef = useRef(state);
  stateRef.current = state;

  const updatePosition = useCallback((position?: LatLng) => {
    setState((prev) => ({
      ...prev,
      position,
      latInput: position ? String(position.lat) : "",
      lngInput: position ? String(position.lng) : "",
    }));
  }, []);

  // Stable — reads locationInitialized via ref to avoid recreating on every change.
  const handlePositionChange = useCallback(
    (position: LatLng) => {
      if (!locationInitializedRef.current) setLocationInitialized(true);
      updatePosition(position);
    },
    [updatePosition],
  );

  // Stable — merges coordinate update into a single functional setState, avoiding closure over state.position.
  const updateCoordinate = useCallback((type: "lat" | "lng", value: string) => {
    const num = parseFloat(value);
    const isValid = type === "lat" ? !isNaN(num) && num >= -90 && num <= 90 : !isNaN(num) && num >= -180 && num <= 180;
    setState((prev) => {
      const next = { ...prev, [type === "lat" ? "latInput" : "lngInput"]: value };
      if (isValid && prev.position) {
        const newPos = type === "lat" ? new LatLng(num, prev.position.lng) : new LatLng(prev.position.lat, num);
        return { ...next, position: newPos, latInput: String(newPos.lat), lngInput: String(newPos.lng) };
      }
      return next;
    });
  }, []);

  // Stable reference — uses functional setState, no closure deps.
  const setPlaceholder = useCallback((placeholder: string) => {
    setState((prev) => ({ ...prev, placeholder }));
  }, []);

  const reset = useCallback(() => {
    setState({
      placeholder: "",
      position: undefined,
      latInput: "",
      lngInput: "",
    });
    setLocationInitialized(false);
  }, []);

  // Stable — reads latest state via ref, no closure over state.
  const getLocation = useCallback((): Location | undefined => {
    const { position, placeholder } = stateRef.current;
    if (!position || !placeholder.trim()) {
      return undefined;
    }
    return create(LocationSchema, {
      latitude: position.lat,
      longitude: position.lng,
      placeholder,
    });
  }, []);

  return useMemo(
    () => ({ state, locationInitialized, handlePositionChange, updateCoordinate, setPlaceholder, reset, getLocation }),
    [state, locationInitialized, handlePositionChange, updateCoordinate, setPlaceholder, reset, getLocation],
  );
};
