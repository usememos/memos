/**
 * Unified memo metadata components
 * Provides consistent styling and behavior across editor and view modes
 */

export { default as LocationDisplay } from "./LocationDisplay";
export { default as AttachmentList } from "./AttachmentList";
export { default as RelationList } from "./RelationList";

// Base components (can be used for other metadata types)
export { default as MetadataCard } from "./MetadataCard";
export { default as AttachmentCard } from "./AttachmentCard";
export { default as RelationCard } from "./RelationCard";

// Types
export type { DisplayMode, BaseMetadataProps } from "./types";
