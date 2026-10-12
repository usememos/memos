import { useCallback, useEffect, useRef } from "react";

export function useBlobUrls() {
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(
    () => () => {
      for (const url of urlsRef.current) {
        URL.revokeObjectURL(url);
      }
    },
    [],
  );

  // Stable identity so callers can hold it in useCallback dependencies.
  const createBlobUrl = useCallback((blob: Blob | File): string => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);

  return { createBlobUrl };
}
