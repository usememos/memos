import { useEffect, useRef } from "react";

/**
 * Custom hook for managing blob URLs lifecycle
 * Automatically tracks and cleans up all blob URLs on unmount to prevent memory leaks
 *
 * @returns Object with methods to create, revoke, and manage blob URLs
 *
 * @example
 * ```tsx
 * const { createBlobUrl, revokeBlobUrl, revokeAll } = useBlobUrls();
 *
 * // Create blob URL (automatically tracked)
 * const url = createBlobUrl(file);
 *
 * // Manually revoke when needed
 * revokeBlobUrl(url);
 *
 * // All URLs are automatically revoked on unmount
 * ```
 */
export function useBlobUrls() {
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Clean up all blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  /**
   * Creates a blob URL from a file or blob and tracks it for automatic cleanup
   */
  const createBlobUrl = (blob: Blob | File): string => {
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.add(url);
    return url;
  };

  /**
   * Revokes a specific blob URL and removes it from tracking
   */
  const revokeBlobUrl = (url: string): void => {
    if (blobUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  };

  /**
   * Revokes all tracked blob URLs
   */
  const revokeAll = (): void => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current.clear();
  };

  return {
    createBlobUrl,
    revokeBlobUrl,
    revokeAll,
  };
}
