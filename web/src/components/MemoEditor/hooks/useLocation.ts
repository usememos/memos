import { create } from "@bufbuild/protobuf";
import { useCallback, useMemo, useRef, useState } from "react";
import type { MapPoint } from "@/components/map/types";
import { Location, LocationSchema } from "@/types/proto/api/v1/memo_service_pb";
import { LocationState } from "../types/insertMenu";

export const useLocation = (initialLocation?: Location) => {
  const [locationInitialized, setLocationInitialized] = useState(false);
  const locationInitializedRef = useRef(locationInitialized);
  locationInitializedRef.current = locationInitialized;

  const [state, setState] = useState<LocationState>({
    placeholder: initialLocation?.placeholder || "",
    position: initialLocation ? { lat: initialLocation.latitude, lng: initialLocation.longitude } : undefined,
    latInput: initialLocation ? String(initialLocation.latitude) : "",
    lngInput: initialLocation ? String(initialLocation.longitude) : "",
  });

  // Ref to latest state so getLocation can be stable without closing over state.
  const stateRef = useRef(state);
  stateRef.current = state;

  const updatePosition = useCallback((position?: MapPoint) => {
    setState((prev) => ({
      ...prev,
      position,
      latInput: position ? String(position.lat) : "",
      lngInput: position ? String(position.lng) : "",
    }));
  }, []);

  // Stable — reads locationInitialized via ref to avoid recreating on every change.
  const handlePositionChange = useCallback(
    (position: MapPoint) => {
      if (!locationInitializedRef.current) setLocationInitialized(true);
      updatePosition(position);
    },
    [updatePosition],
  );

  // Stable — derives the position from both coordinate inputs, so manual entry works before a map point exists.
  const updateCoordinate = useCallback((type: "lat" | "lng", value: string) => {
    setState((prev) => {
      const next = { ...prev, [type === "lat" ? "latInput" : "lngInput"]: value };
      const lat = Number(next.latInput);
      const lng = Number(next.lngInput);
      const hasValidPosition =
        next.latInput.trim() !== "" &&
        next.lngInput.trim() !== "" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180;

      return { ...next, position: hasValidPosition ? { lat, lng } : undefined };
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
