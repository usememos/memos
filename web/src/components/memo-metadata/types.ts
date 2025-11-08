/**
 * Common types for memo metadata components
 */

export type DisplayMode = "edit" | "view";

export interface BaseMetadataProps {
  mode: DisplayMode;
  className?: string;
}
