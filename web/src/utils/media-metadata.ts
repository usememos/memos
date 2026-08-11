import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "./format";

export interface MediaLocationDisplay {
  latitude: number;
  longitude: number;
  coordinates: string;
  altitude?: string;
}

export interface MediaMetadataDisplay {
  file?: string;
  dimensions?: string;
  uploaded?: string;
  duration?: string;
  captured?: string;
  utcOffset?: string;
  camera?: string;
  lens?: string;
  exposure?: string;
  location?: MediaLocationDisplay;
  sourceExifOrientation?: number;
  hasSavedMetadata: boolean;
}

const formatNumber = (value: number, locale: string, maximumFractionDigits = 2) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);

const formatCivilDateTime = (value: string, locale: string): string | undefined => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(date);
};

export const formatMediaDuration = (seconds: number): string => {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

export const formatExposureTime = (seconds: number, locale: string): string => {
  if (seconds > 0 && seconds < 1) {
    const reciprocal = 1 / seconds;
    const roundedReciprocal = Math.round(reciprocal);
    if (roundedReciprocal > 0 && Math.abs(reciprocal - roundedReciprocal) / roundedReciprocal < 0.01) {
      return `1/${roundedReciprocal} s`;
    }
  }
  return `${formatNumber(seconds, locale, 4)} s`;
};

export const buildMediaMetadataDisplay = (attachments: Attachment[] | undefined, locale: string): MediaMetadataDisplay => {
  if (!attachments || attachments.length === 0) {
    return { hasSavedMetadata: false };
  }

  const photoAttachment = attachments.find((attachment) => attachment.mediaMetadata?.details.case === "photo");
  const videoAttachment = attachments.find((attachment) => attachment.mediaMetadata?.details.case === "video");
  const primaryAttachment = photoAttachment ?? videoAttachment ?? attachments[0];
  const photoMetadata = photoAttachment?.mediaMetadata?.details;
  const photo = photoMetadata?.case === "photo" ? photoMetadata.value : undefined;
  const videoMetadata = videoAttachment?.mediaMetadata?.details;
  const video = videoMetadata?.case === "video" ? videoMetadata.value : undefined;
  const dimensionsMetadata = attachments.find(
    (attachment) => attachment.mediaMetadata?.width !== undefined && attachment.mediaMetadata.height !== undefined,
  )?.mediaMetadata;
  const totalSize = attachments.reduce((total, attachment) => total + attachment.size, 0n);
  const fileParts = [getFileTypeLabel(primaryAttachment.type), totalSize > 0n ? formatFileSize(Number(totalSize)) : undefined].filter(
    Boolean,
  );
  const camera = [photo?.cameraMake, photo?.cameraModel].filter(Boolean).join(" ") || undefined;
  const exposure = [
    photo?.fNumber !== undefined ? `ƒ/${formatNumber(photo.fNumber, locale)}` : undefined,
    photo?.exposureTimeSeconds !== undefined ? formatExposureTime(photo.exposureTimeSeconds, locale) : undefined,
    photo?.iso !== undefined ? `ISO ${photo.iso}` : undefined,
    photo?.focalLengthMm !== undefined ? `${formatNumber(photo.focalLengthMm, locale)} mm` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const location =
    photo?.location?.latitude !== undefined && photo.location.longitude !== undefined
      ? {
          latitude: photo.location.latitude,
          longitude: photo.location.longitude,
          coordinates: `${photo.location.latitude.toFixed(5)}°, ${photo.location.longitude.toFixed(5)}°`,
          altitude: photo.location.altitudeMeters !== undefined ? `${formatNumber(photo.location.altitudeMeters, locale, 1)} m` : undefined,
        }
      : undefined;

  return {
    file: fileParts.join(" · ") || undefined,
    dimensions:
      dimensionsMetadata?.width !== undefined && dimensionsMetadata.height !== undefined
        ? `${dimensionsMetadata.width} × ${dimensionsMetadata.height} px`
        : undefined,
    uploaded: primaryAttachment.createTime
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(timestampDate(primaryAttachment.createTime))
      : undefined,
    duration: video?.durationSeconds !== undefined ? formatMediaDuration(video.durationSeconds) : undefined,
    captured: photo?.captureTime?.localDateTime ? formatCivilDateTime(photo.captureTime.localDateTime, locale) : undefined,
    utcOffset: photo?.captureTime?.utcOffset,
    camera,
    lens: photo?.lensModel || undefined,
    exposure: exposure || undefined,
    location,
    sourceExifOrientation: photo?.sourceExifOrientation,
    hasSavedMetadata: attachments.some((attachment) => attachment.mediaMetadata !== undefined),
  };
};
