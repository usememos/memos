import { describe, expect, it } from "vitest";
import {
  ExcalidrawActionError,
  excalidrawPreviewFilename,
  findExcalidrawPreview,
  isExcalidrawFilename,
  isExcalidrawPreviewFilename,
  newExcalidrawFilename,
  parseExcalidrawFile,
} from "@/components/Excalidraw/excalidraw";
import { applyExcalidrawSave } from "@/components/MemoEditor/edit/hooks/useExcalidraw";
import type { LocalFile } from "@/components/MemoEditor/edit/types/attachment";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";

const attachment = (name: string, filename: string) => ({ name, filename, creator: "users/1" }) as unknown as Attachment;
const localFile = (name: string, previewUrl: string, replaces?: string): LocalFile =>
  ({ file: new File(["x"], name), previewUrl, replaces }) as LocalFile;
const always = () => true;

describe("Excalidraw file names", () => {
  it("recognizes sources and previews by name", () => {
    expect(isExcalidrawFilename("Plan.EXCALIDRAW")).toBe(true);
    expect(isExcalidrawFilename("plan.excalidraw.png")).toBe(false);
    expect(isExcalidrawPreviewFilename("plan.excalidraw.png")).toBe(true);
    expect(isExcalidrawPreviewFilename("plan.canvas.png")).toBe(false);
    expect(excalidrawPreviewFilename("plan.excalidraw")).toBe("plan.excalidraw.png");
  });

  it("names a new drawing by its local time", () => {
    expect(newExcalidrawFilename(new Date(2026, 0, 2, 3, 4, 5))).toBe("excalidraw-20260102-030405.excalidraw");
  });

  it("pairs a source with the preview named after it", () => {
    const source = attachment("attachments/a", "plan.excalidraw");
    const preview = attachment("attachments/b", "plan.excalidraw.png");
    const other = attachment("attachments/c", "other.excalidraw.png");
    expect(findExcalidrawPreview(source, [source, other, preview])).toBe(preview);
    expect(findExcalidrawPreview(source, [source, other])).toBeUndefined();
  });
});

describe("parseExcalidrawFile", () => {
  it("reads the scene, embedded files included", () => {
    const text = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [{ id: "1", type: "image", fileId: "f1" }],
      appState: { viewBackgroundColor: "#fff" },
      files: { f1: { id: "f1", dataURL: "data:image/png;base64,AA==", mimeType: "image/png" } },
    });
    const scene = parseExcalidrawFile(text);
    expect(scene.elements).toHaveLength(1);
    expect(scene.appState).toEqual({ viewBackgroundColor: "#fff" });
    expect(Object.keys(scene.files ?? {})).toEqual(["f1"]);
  });

  it("rejects text that is not an Excalidraw scene", () => {
    expect(() => parseExcalidrawFile("not json")).toThrow(ExcalidrawActionError);
    expect(() => parseExcalidrawFile(JSON.stringify({ type: "other", elements: [] }))).toThrow(ExcalidrawActionError);
    expect(() => parseExcalidrawFile(JSON.stringify({ type: "excalidraw" }))).toThrow(ExcalidrawActionError);
  });
});

describe("applyExcalidrawSave", () => {
  const files = { source: localFile("plan.excalidraw", "blob:source"), preview: localFile("plan.excalidraw.png", "blob:preview") };

  it("adds a new drawing as its source and preview", () => {
    const result = applyExcalidrawSave(
      { localFiles: [], attachments: [attachment("attachments/x", "x.txt")], order: [] },
      { kind: "new" },
      files,
      always,
    );
    expect(result.localFiles.map((file) => file.previewUrl)).toEqual(["blob:source", "blob:preview"]);
    expect(result.order).toEqual(["attachments/x", "blob:source", "blob:preview"]);
  });

  it("replaces a saved pair in place instead of adding files", () => {
    const source = attachment("attachments/s", "plan.excalidraw");
    const preview = attachment("attachments/p", "plan.excalidraw.png");
    const result = applyExcalidrawSave(
      { localFiles: [], attachments: [source, preview], order: [] },
      { kind: "attachment", name: source.name, canReplace: true },
      files,
      always,
    );
    expect(result.localFiles.map((file) => file.replaces)).toEqual(["attachments/s", "attachments/p"]);
    expect(result.order).toEqual(["attachments/s", "attachments/p"]);
  });

  it("supersedes an earlier pending edit of the same pair", () => {
    const source = attachment("attachments/s", "plan.excalidraw");
    const preview = attachment("attachments/p", "plan.excalidraw.png");
    const earlier = [
      localFile("plan.excalidraw", "blob:old-source", source.name),
      localFile("plan.excalidraw.png", "blob:old-preview", preview.name),
    ];
    const result = applyExcalidrawSave(
      { localFiles: earlier, attachments: [source, preview], order: [] },
      { kind: "attachment", name: source.name, canReplace: true },
      files,
      always,
    );
    expect(result.localFiles.map((file) => file.previewUrl)).toEqual(["blob:source", "blob:preview"]);
  });

  it("adds the missing preview of a source attached from disk", () => {
    const source = attachment("attachments/s", "plan.excalidraw");
    const result = applyExcalidrawSave(
      { localFiles: [], attachments: [source, attachment("attachments/z", "z.txt")], order: [] },
      { kind: "attachment", name: source.name, canReplace: true },
      files,
      always,
    );
    expect(result.localFiles.map((file) => [file.previewUrl, file.replaces])).toEqual([
      ["blob:source", "attachments/s"],
      ["blob:preview", undefined],
    ]);
    expect(result.order).toEqual(["attachments/s", "blob:preview", "attachments/z"]);
  });

  it("adds a copy when the saved drawing can't be replaced", () => {
    const source = attachment("attachments/s", "plan.excalidraw");
    const result = applyExcalidrawSave(
      { localFiles: [], attachments: [source], order: [] },
      { kind: "attachment", name: source.name, canReplace: false },
      files,
      always,
    );
    expect(result.localFiles.every((file) => file.replaces === undefined)).toBe(true);
    expect(result.order).toEqual(["attachments/s", "blob:source", "blob:preview"]);
  });

  it("swaps a draft's pair in place", () => {
    const draft = [localFile("plan.excalidraw", "blob:a"), localFile("plan.excalidraw.png", "blob:b")];
    const result = applyExcalidrawSave(
      { localFiles: draft, attachments: [], order: [] },
      { kind: "local", previewUrl: "blob:a" },
      files,
      always,
    );
    expect(result.localFiles.map((file) => file.previewUrl)).toEqual(["blob:source", "blob:preview"]);
    expect(result.order).toEqual(["blob:source", "blob:preview"]);
  });
});
