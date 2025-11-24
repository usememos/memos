/**
 * Unified memo metadata components
 * Provides consistent styling and behavior across editor and view modes
 */

export { default as AttachmentCard } from "./AttachmentCard";
export { default as AttachmentList } from "./AttachmentList";
export { default as LocationDisplay } from "./LocationDisplay";

// Base components (can be used for other metadata types)
export { default as MetadataCard } from "./MetadataCard";
export { default as RelationCard } from "./RelationCard";
export { default as RelationList } from "./RelationList";

// Types
export type { AttachmentItem, BaseMetadataProps, DisplayMode, FileCategory, LocalFile } from "./types";
export { attachmentToItem, fileToItem, filterByCategory, separateMediaAndDocs, toAttachmentItems } from "./types";
