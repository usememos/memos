/**
 * Common types for memo metadata components
 */

import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";

export type DisplayMode = "edit" | "view";

export interface BaseMetadataProps {
  mode: DisplayMode;
  className?: string;
}

/**
 * File type categories for consistent handling across components
 */
export type FileCategory = "image" | "video" | "document";

/**
 * Pure view model for rendering attachments and local files
 * Contains only presentation data needed by UI components
 * Does not store references to original domain objects for cleaner architecture
 */
export interface AttachmentItem {
  /** Unique identifier - stable across renders */
  readonly id: string;
  /** Display name for the file */
  readonly filename: string;
  /** Categorized file type */
  readonly category: FileCategory;
  /** MIME type for detailed handling if needed */
  readonly mimeType: string;
  /** URL for thumbnail/preview display */
  readonly thumbnailUrl: string;
  /** URL for full file access */
  readonly sourceUrl: string;
  /** Size in bytes (optional) */
  readonly size?: number;
  /** Whether this represents a local file not yet uploaded */
  readonly isLocal: boolean;
}

/**
 * Determine file category from MIME type
 */
function categorizeFile(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

/**
 * Convert an uploaded Attachment to AttachmentItem view model
 */
export function attachmentToItem(attachment: Attachment): AttachmentItem {
  const attachmentType = getAttachmentType(attachment);
  const sourceUrl = getAttachmentUrl(attachment);

  return {
    id: attachment.name,
    filename: attachment.filename,
    category: categorizeFile(attachment.type),
    mimeType: attachment.type,
    thumbnailUrl: attachmentType === "image/*" ? getAttachmentThumbnailUrl(attachment) : sourceUrl,
    sourceUrl,
    size: attachment.size,
    isLocal: false,
  };
}

/**
 * Convert a local File with blob URL to AttachmentItem view model
 */
export function fileToItem(file: File, blobUrl: string): AttachmentItem {
  return {
    id: blobUrl, // Use blob URL as unique ID since we don't have a server ID yet
    filename: file.name,
    category: categorizeFile(file.type),
    mimeType: file.type,
    thumbnailUrl: blobUrl,
    sourceUrl: blobUrl,
    size: file.size,
    isLocal: true,
  };
}

/**
 * Simple container for local files with their blob URLs
 * Kept minimal to avoid unnecessary abstraction
 */
export interface LocalFile {
  readonly file: File;
  readonly previewUrl: string;
}

/**
 * Batch convert attachments and local files to AttachmentItems
 * Returns items in order: uploaded first, then local
 */
export function toAttachmentItems(attachments: Attachment[], localFiles: LocalFile[] = []): AttachmentItem[] {
  return [...attachments.map(attachmentToItem), ...localFiles.map(({ file, previewUrl }) => fileToItem(file, previewUrl))];
}

/**
 * Filter items by category for specialized rendering
 */
export function filterByCategory(items: AttachmentItem[], categories: FileCategory[]): AttachmentItem[] {
  const categorySet = new Set(categories);
  return items.filter((item) => categorySet.has(item.category));
}

/**
 * Separate items into media (image/video) and documents
 */
export function separateMediaAndDocs(items: AttachmentItem[]): { media: AttachmentItem[]; docs: AttachmentItem[] } {
  const media: AttachmentItem[] = [];
  const docs: AttachmentItem[] = [];

  for (const item of items) {
    if (item.category === "image" || item.category === "video") {
      media.push(item);
    } else {
      docs.push(item);
    }
  }

  return { media, docs };
}
