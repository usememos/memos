export { default as AttachmentList } from "./AttachmentList";
export { default as LocationDisplay } from "./LocationDisplay";

// Base components (can be used for other metadata types)
export { default as MetadataCard } from "./MetadataCard";
export { default as RelationCard } from "./RelationCard";
export { default as RelationList } from "./RelationList";

// Types
export type { AttachmentItem, FileCategory, LocalFile } from "./types";
export { attachmentToItem, fileToItem, filterByCategory, separateMediaAndDocs, toAttachmentItems } from "./types";
