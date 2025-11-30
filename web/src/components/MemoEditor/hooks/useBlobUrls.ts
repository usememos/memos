import { useEffect, useRef } from "react";

/**
 * Hook for managing blob URLs lifecycle with automatic cleanup
 */
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

  return {
    createBlobUrl: (blob: Blob | File): string => {
      const url = URL.createObjectURL(blob);
      urlsRef.current.add(url);
      return url;
    },
    revokeBlobUrl: (url: string) => {
      if (urlsRef.current.has(url)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(url);
      }
    },
  };
}
