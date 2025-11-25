import { useState } from "react";
import type { LocalFile } from "@/components/memo-metadata";
import { useBlobUrls } from "./useBlobUrls";

/**
 * Custom hook for managing local file uploads with preview
 * Handles file state, blob URL creation, and cleanup
 *
 * @returns Object with file state and management functions
 *
 * @example
 * ```tsx
 * const { localFiles, addFiles, removeFile, clearFiles } = useLocalFileManager();
 *
 * // Add files from input or drag-drop
 * addFiles(fileList);
 *
 * // Remove specific file
 * removeFile(previewUrl);
 *
 * // Clear all (e.g., after successful upload)
 * clearFiles();
 * ```
 */
export function useLocalFileManager() {
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const { createBlobUrl, revokeBlobUrl } = useBlobUrls();

  /**
   * Adds files to local state with blob URL previews
   */
  const addFiles = (files: FileList | File[]): void => {
    const fileArray = Array.from(files);
    const newLocalFiles: LocalFile[] = fileArray.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));
    setLocalFiles((prev) => [...prev, ...newLocalFiles]);
  };

  /**
   * Removes a specific file by preview URL
   */
  const removeFile = (previewUrl: string): void => {
    setLocalFiles((prev) => {
      const toRemove = prev.find((f) => f.previewUrl === previewUrl);
      if (toRemove) {
        revokeBlobUrl(toRemove.previewUrl);
      }
      return prev.filter((f) => f.previewUrl !== previewUrl);
    });
  };

  /**
   * Clears all files and revokes their blob URLs
   */
  const clearFiles = (): void => {
    localFiles.forEach(({ previewUrl }) => revokeBlobUrl(previewUrl));
    setLocalFiles([]);
  };

  return {
    localFiles,
    addFiles,
    removeFile,
    clearFiles,
  };
}
