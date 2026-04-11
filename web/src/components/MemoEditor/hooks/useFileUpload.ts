import { create } from "@bufbuild/protobuf";
import { useRef } from "react";
import { type MotionMedia, MotionMediaFamily, MotionMediaRole, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";
import type { LocalFile } from "../types/attachment";

export const useFileUpload = (onFilesSelected: (localFiles: LocalFile[]) => void) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectingFlagRef = useRef(false);

  const handleFileInputChange = (event?: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(fileInputRef.current?.files || event?.target.files || []);
    if (files.length === 0 || selectingFlagRef.current) {
      return;
    }
    selectingFlagRef.current = true;
    const localFiles: LocalFile[] = pairAppleLivePhotoFiles(
      files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        origin: "upload",
      })),
    );
    onFilesSelected(localFiles);
    selectingFlagRef.current = false;
    // Optionally clear input value to allow re-selecting the same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadClick = (accept = "*") => {
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

const pairAppleLivePhotoFiles = (localFiles: LocalFile[]): LocalFile[] => {
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
