import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Translations } from "@/utils/i18n";

/*
 * An Excalidraw drawing is two attachments of one memo: the editable source
 * (`name.excalidraw`, Excalidraw's own JSON file) and a PNG made from it
 * (`name.excalidraw.png`), which the memo's gallery shows. The preview is found
 * by its name, so the pair survives reordering, and a source attached from disk
 * gets its preview on the first save.
 */

export const EXCALIDRAW_EXTENSION = ".excalidraw";

/** Excalidraw's registered type. Files added from disk may come with no type, so names decide. */
export const EXCALIDRAW_MIME_TYPE = "application/vnd.excalidraw+json";

export const isExcalidrawFilename = (filename: string): boolean => filename.toLowerCase().endsWith(EXCALIDRAW_EXTENSION);

/** The preview's name: the source's, with `.png` after it. */
export const excalidrawPreviewFilename = (sourceFilename: string): string => `${sourceFilename}.png`;

export const isExcalidrawPreviewFilename = (filename: string): boolean => filename.toLowerCase().endsWith(`${EXCALIDRAW_EXTENSION}.png`);

const pad = (value: number) => String(value).padStart(2, "0");

/** `excalidraw-YYYYMMDD-HHMMSS.excalidraw`, in local time, like the other files memos names. */
export const newExcalidrawFilename = (now = new Date()): string =>
  `excalidraw-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${EXCALIDRAW_EXTENSION}`;

/** The preview of `source` among `candidates`: the one named after it, never the source itself. */
export const findExcalidrawPreview = <T extends Pick<Attachment, "name" | "filename">>(
  source: Pick<Attachment, "name" | "filename">,
  candidates: readonly T[],
): T | undefined => {
  const previewName = excalidrawPreviewFilename(source.filename);
  return candidates.find((candidate) => candidate.name !== source.name && candidate.filename === previewName);
};

/** What the editor opens: the scene fields Excalidraw restores, kept loose so this module stays light. */
export interface ExcalidrawSceneData {
  elements: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

/** Reads an `.excalidraw` file. Throws when the text is not an Excalidraw scene. */
export const parseExcalidrawFile = (text: string): ExcalidrawSceneData => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ExcalidrawActionError("editor.excalidraw.invalid-file");
  }
  if (
    !data ||
    typeof data !== "object" ||
    (data as { type?: unknown }).type !== "excalidraw" ||
    !Array.isArray((data as { elements?: unknown }).elements)
  ) {
    throw new ExcalidrawActionError("editor.excalidraw.invalid-file");
  }
  const scene = data as { elements: unknown[]; appState?: unknown; files?: unknown };
  return {
    elements: scene.elements,
    appState: scene.appState && typeof scene.appState === "object" ? (scene.appState as Record<string, unknown>) : undefined,
    files: scene.files && typeof scene.files === "object" ? (scene.files as Record<string, unknown>) : undefined,
  };
};

/** A failure with a message the user can act on; others show the generic save or open error. */
export class ExcalidrawActionError extends Error {
  constructor(public readonly label: Translations) {
    super(label);
  }
}

/** The two files a save produces. */
export interface ExcalidrawFiles {
  source: File;
  preview: File;
}
