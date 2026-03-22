import { useEffect, useRef } from "react";

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
