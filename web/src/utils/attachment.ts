import { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

export const getAttachmentUrl = (attachment: Attachment) => {
  if (attachment.externalLink) {
    return attachment.externalLink;
  }

  return `${window.location.origin}/file/${attachment.name}/${attachment.filename}`;
};

export const getAttachmentThumbnailUrl = (attachment: Attachment) => {
  return `${window.location.origin}/file/${attachment.name}/${attachment.filename}?thumbnail=true`;
};

export const getAttachmentType = (attachment: Attachment) => {
  if (isImage(attachment.type)) {
    return "image/*";
  } else if (attachment.type.startsWith("video")) {
    return "video/*";
  } else if (attachment.type.startsWith("audio") && !isMidiFile(attachment.type)) {
    return "audio/*";
  } else if (attachment.type.startsWith("text")) {
    return "text/*";
  } else if (attachment.type.startsWith("application/epub+zip")) {
    return "application/epub+zip";
  } else if (attachment.type.startsWith("application/pdf")) {
    return "application/pdf";
  } else if (attachment.type.includes("word")) {
    return "application/msword";
  } else if (attachment.type.includes("excel")) {
    return "application/msexcel";
  } else if (attachment.type.startsWith("application/zip")) {
    return "application/zip";
  } else if (attachment.type.startsWith("application/x-java-archive")) {
    return "application/x-java-archive";
  } else {
    return "application/octet-stream";
  }
};

// isImage returns true if the given mime type is an image.
export const isImage = (t: string) => {
  // Don't show PSDs as images.
  return t.startsWith("image/") && !isPSD(t);
};

// isMidiFile returns true if the given mime type is a MIDI file.
export const isMidiFile = (mimeType: string): boolean => {
  return mimeType === "audio/midi" || mimeType === "audio/mid" || mimeType === "audio/x-midi" || mimeType === "application/x-midi";
};

const isPSD = (t: string) => {
  return t === "image/vnd.adobe.photoshop" || t === "image/x-photoshop" || t === "image/photoshop";
};

// HDR-capable MIME types that support wide color gamut
export const HDR_CAPABLE_FORMATS = [
  "image/heic",
  "image/heif",
  "image/webp",
  "image/png", // PNG can contain ICC profiles for wide gamut
  "image/jpeg", // JPEG can support extended color via profiles
  "video/mp4", // Can contain HDR tracks
  "video/quicktime", // Can contain HDR tracks
  "video/x-matroska", // Can contain HDR tracks
  "video/webm", // VP9 Profile 2 for HDR
];

// isHDRCapable returns true if the MIME type supports HDR/wide color gamut.
export const isHDRCapable = (mimeType: string): boolean => {
  return HDR_CAPABLE_FORMATS.some((format) => mimeType.startsWith(format));
};

// getColorspace returns the appropriate colorspace attribute for wide gamut images.
// Returns "display-p3" for HDR-capable formats, undefined for standard images.
export const getColorspace = (mimeType: string): string | undefined => {
  return isHDRCapable(mimeType) ? "display-p3" : undefined;
};

// supportsHDR checks if the browser supports wide color gamut display.
// Uses CSS.supports() to detect color-gamut capability.
export const supportsHDR = (): boolean => {
  if (typeof CSS === "undefined") return false;
  return CSS.supports("(color-gamut: srgb)") && CSS.supports("(color-gamut: p3)");
};
