import { create } from "@bufbuild/protobuf";
import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { type MotionMedia, MotionMediaFamily, MotionMediaRole, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { mediaMetadataService } from "../services/mediaMetadataService";
import type { LocalFile } from "../types/attachment";
import { useBlobUrls } from "./useBlobUrls";

/**
 * Single ingest point turning picked/pasted/dropped Files into LocalFiles.
 * Media metadata extraction starts here (not at upload time) so every upload
 * path inherits the preference from the LocalFile instead of threading it.
 */
export const toLocalFiles = (files: File[], options: { createBlobUrl: (file: File) => string; saveMediaMetadata: boolean }): LocalFile[] =>
  pairAppleLivePhotoFiles(
    files.map((file) => ({
      file,
      previewUrl: options.createBlobUrl(file),
      origin: "upload",
      mediaMetadata: options.saveMediaMetadata ? mediaMetadataService.extract(file) : undefined,
    })),
  );

export const useFileUpload = (onFilesSelected: (localFiles: LocalFile[]) => void) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectingFlagRef = useRef(false);
  // Track preview blob URLs so they're revoked on unmount instead of leaking
  // (matches the paste/drop/audio paths, which all go through useBlobUrls).
  const { createBlobUrl } = useBlobUrls();
  const { userGeneralSetting } = useAuth();
  const saveMediaMetadata = userGeneralSetting?.saveMediaMetadata ?? false;

  const handleFileInputChange = (event?: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(fileInputRef.current?.files || event?.target.files || []);
    if (files.length === 0 || selectingFlagRef.current) {
      return;
    }
    selectingFlagRef.current = true;
    const localFiles = toLocalFiles(files, { createBlobUrl, saveMediaMetadata });
    onFilesSelected(localFiles);
    selectingFlagRef.current = false;
    // Optionally clear input value to allow re-selecting the same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadClick = (accept = "") => {
    if (!fileInputRef.current) {
      return;
    }

    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  return {
    fileInputRef,
    selectingFlag: selectingFlagRef.current,
    handleFileInputChange,
    handleUploadClick,
  };
};

export const pairAppleLivePhotoFiles = (localFiles: LocalFile[]): LocalFile[] => {
  const stemMap = new Map<string, LocalFile[]>();
  for (const localFile of localFiles) {
    const stem = normalizeFilenameStem(localFile.file.name);
    const group = stemMap.get(stem) ?? [];
    group.push(localFile);
    stemMap.set(stem, group);
  }

  const groupIds = new Map<string, string>();
  return localFiles.map((localFile) => {
    const stem = normalizeFilenameStem(localFile.file.name);
    const group = stemMap.get(stem) ?? [];
    const images = group.filter((item) => item.file.type.startsWith("image/"));
    const videos = group.filter((item) => item.file.type.startsWith("video/"));
    if (images.length !== 1 || videos.length !== 1) {
      return localFile;
    }

    const image = images[0];
    const video = videos[0];
    const groupId = groupIds.get(stem) ?? `${stem}-${crypto.randomUUID()}`;
    groupIds.set(stem, groupId);
    if (localFile.previewUrl === image.previewUrl) {
      return { ...localFile, motionMedia: buildLocalMotionMedia(groupId, MotionMediaRole.STILL) };
    }
    if (localFile.previewUrl === video.previewUrl) {
      return { ...localFile, motionMedia: buildLocalMotionMedia(groupId, MotionMediaRole.VIDEO) };
    }
    return localFile;
  });
};

const buildLocalMotionMedia = (groupId: string, role: MotionMediaRole): MotionMedia =>
  create(MotionMediaSchema, {
    family: MotionMediaFamily.APPLE_LIVE_PHOTO,
    role,
    groupId,
    presentationTimestampUs: 0n,
    hasEmbeddedVideo: false,
  });

const normalizeFilenameStem = (filename: string): string => {
  const parts = filename.split(".");
  if (parts.length <= 1) {
    return filename.toLowerCase();
  }
  return parts.slice(0, -1).join(".").toLowerCase();
};
