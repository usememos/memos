import type { Location } from "@/types/proto/api/v1/memo_service_pb";

export const getLocationDisplayText = (location: Location): string => {
  return location.placeholder || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
};

export const getLocationCoordinatesText = (location: Location, digits = 4): string => {
  return `${location.latitude.toFixed(digits)}°, ${location.longitude.toFixed(digits)}°`;
};
