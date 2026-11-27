import { lazy } from "react";

export type { ExcalidrawSheetProps } from "./ExcalidrawSheet";
export type { ExcalidrawViewerProps } from "./ExcalidrawViewer";
export {
  EXCALIDRAW_EXTENSION,
  EXCALIDRAW_MIME_TYPE,
  ExcalidrawActionError,
  type ExcalidrawFiles,
  type ExcalidrawSceneData,
  excalidrawPreviewFilename,
  findExcalidrawPreview,
  isExcalidrawFilename,
  isExcalidrawPreviewFilename,
  newExcalidrawFilename,
  parseExcalidrawFile,
} from "./excalidraw";

/** Excalidraw is large: the editor loads on the first drawing, not with the app. */
export const ExcalidrawSheet = lazy(() => import("./ExcalidrawSheet"));

/** Edits a memo's saved Excalidraw source; loads with the editor on first use. */
export const ExcalidrawViewer = lazy(() => import("./ExcalidrawViewer"));
