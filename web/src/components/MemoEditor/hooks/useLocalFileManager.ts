import { useState } from "react";
import type { LocalFile } from "@/components/memo-metadata";
import { useBlobUrls } from "./useBlobUrls";

export function useLocalFileManager() {
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const { createBlobUrl, revokeBlobUrl } = useBlobUrls();

  const addFiles = (files: FileList | File[]): void => {
    const fileArray = Array.from(files);
    const newLocalFiles: LocalFile[] = fileArray.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));
    setLocalFiles((prev) => [...prev, ...newLocalFiles]);
  };

  const removeFile = (previewUrl: string): void => {
    setLocalFiles((prev) => {
      const toRemove = prev.find((f) => f.previewUrl === previewUrl);
      if (toRemove) {
        revokeBlobUrl(toRemove.previewUrl);
      }
      return prev.filter((f) => f.previewUrl !== previewUrl);
    });
  };

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
