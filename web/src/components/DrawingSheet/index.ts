import { lazy } from "react";

export type { DrawingSheetProps } from "./DrawingSheet";
export { type DrawingContent, fetchDrawingFile, isDrawingFilename, readDrawing } from "./drawing";

/** The sheet and the canvas engine load on the first drawing, not with the editor. */
export const DrawingSheet = lazy(() => import("./DrawingSheet"));
