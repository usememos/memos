import { Attachment, MotionMediaFamily, MotionMediaRole } from "@/types/proto/api/v1/attachment_service_pb";

export const getAttachmentUrl = (attachment: Attachment) => {
  if (attachment.externalLink) {
    return attachment.externalLink;
  }

  return `${window.location.origin}/file/${attachment.name}/${attachment.filename}`;
};

export const getAttachmentThumbnailUrl = (attachment: Attachment) => {
  return `${window.location.origin}/file/${attachment.name}/${attachment.filename}?thumbnail=true`;
};

export const getAttachmentMotionClipUrl = (attachment: Attachment) => {
  return `${window.location.origin}/file/${attachment.name}/${attachment.filename}?motion=true`;
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

export const getAttachmentMotionGroupId = (attachment: Attachment): string | undefined => {
  return attachment.motionMedia?.groupId || undefined;
};

export const isAppleLivePhotoStill = (attachment: Attachment): boolean =>
  attachment.motionMedia?.family === MotionMediaFamily.APPLE_LIVE_PHOTO && attachment.motionMedia.role === MotionMediaRole.STILL;

export const isAppleLivePhotoVideo = (attachment: Attachment): boolean =>
  attachment.motionMedia?.family === MotionMediaFamily.APPLE_LIVE_PHOTO && attachment.motionMedia.role === MotionMediaRole.VIDEO;

export const isAndroidMotionContainer = (attachment: Attachment): boolean =>
  attachment.motionMedia?.family === MotionMediaFamily.ANDROID_MOTION_PHOTO &&
  attachment.motionMedia.role === MotionMediaRole.CONTAINER &&
  attachment.motionMedia.hasEmbeddedVideo;

export const isMotionAttachment = (attachment: Attachment): boolean =>
  isAppleLivePhotoStill(attachment) || isAppleLivePhotoVideo(attachment) || isAndroidMotionContainer(attachment);
