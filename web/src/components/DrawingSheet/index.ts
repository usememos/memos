import { lazy } from "react";

export type { DrawingSheetProps } from "./DrawingSheet";
export type { DrawingViewerProps } from "./DrawingViewer";
export { type DrawingContent, fetchDrawingFile, isDrawingFilename, readDrawing } from "./drawing";
export { DRAWING_PAPER } from "./useCanvasTheme";

/** The sheet and the canvas engine load on the first drawing, not with the editor. */
export const DrawingSheet = lazy(() => import("./DrawingSheet"));

/** The read-only viewer a drawing opens in from a memo; loads with the canvas engine on first use. */
export const DrawingViewer = lazy(() => import("./DrawingViewer"));
