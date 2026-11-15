import type { Scene } from "@usememos/canvas";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { fetchAttachmentFile } from "@/utils/attachment";

/**
 * A drawing is a PNG attachment with its editable scene embedded. The name is a hint
 * (`drawing-YYYYMMDD-HHMMSS.canvas.png`); the scene chunk inside the file is the truth.
 */
export const DRAWING_FILENAME_SUFFIX = ".canvas.png";

export const isDrawingFilename = (filename: string): boolean => filename.toLowerCase().endsWith(DRAWING_FILENAME_SUFFIX);

/** What "Edit drawing" opens: the scene read from the file, or, without one, the file as a background picture. */
export type DrawingContent = { scene: Scene; background?: undefined } | { scene?: undefined; background: Blob };

/**
 * Downloads the original file of a saved drawing. Never the thumbnail: that is a
 * re-encoded JPEG without the scene.
 */
export const fetchDrawingFile = async (attachment: Attachment, signal?: AbortSignal): Promise<Blob> =>
  (await fetchAttachmentFile(attachment, signal)).blob();

/** Reads the scene out of a drawing file. The canvas package loads only when a drawing is opened. */
export const readDrawing = async (file: Blob): Promise<DrawingContent> => {
  const { readScenePng } = await import("@usememos/canvas");
  const { scene } = await readScenePng(file);
  return scene ? { scene } : { background: file };
};
