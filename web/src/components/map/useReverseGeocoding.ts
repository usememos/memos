import { useQuery } from "@tanstack/react-query";

const GEOCODING = {
  endpoint: "https://nominatim.openstreetmap.org/reverse",
  userAgent: "Memos/1.0 (https://github.com/usememos/memos)",
  format: "json",
} as const;

export const useReverseGeocoding = (lat: number | undefined, lng: number | undefined) => {
  return useQuery({
    queryKey: ["geocoding", lat, lng],
    queryFn: async () => {
      const coordString = `${lat?.toFixed(6)}, ${lng?.toFixed(6)}`;
      if (lat === undefined || lng === undefined) return "";

      try {
        const url = `${GEOCODING.endpoint}?lat=${lat}&lon=${lng}&format=${GEOCODING.format}`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": GEOCODING.userAgent,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return (data?.display_name as string) || coordString;
      } catch (error) {
        console.error("Failed to fetch reverse geocoding data:", error);
        return coordString;
      }
    },
    enabled: lat !== undefined && lng !== undefined,
    staleTime: Infinity,
  });
};
