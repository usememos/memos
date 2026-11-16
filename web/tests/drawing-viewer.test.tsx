import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { insertSceneChunk, type Scene } from "@usememos/canvas";
import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DrawingViewer from "@/components/DrawingSheet/DrawingViewer";
import { AttachmentGallery } from "@/components/MemoMetadata/Attachment/AttachmentListView";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";
import { User_Role, UserSchema } from "@/types/proto/api/user_service_pb";

const mocks = vi.hoisted(() => ({
  canvasProps: [] as Array<{ readOnly?: boolean; initialScene?: { elements: unknown[] } }>,
  uploadFile: vi.fn(),
  updateMemo: vi.fn(),
  getMemo: vi.fn(),
  currentUser: undefined as unknown,
}));

const handle = {
  setTool: vi.fn(),
  setReadOnly: vi.fn(),
  getScene: vi.fn(),
  setScene: vi.fn(),
  setStyle: vi.fn(),
  focus: vi.fn(),
  zoomToFit: vi.fn(),
  zoomTo: vi.fn(),
  getViewport: () => ({ zoom: 1, scrollX: 0, scrollY: 0 }),
  canUndo: vi.fn(() => false),
  canRedo: () => false,
  isDirty: () => true,
  markSaved: vi.fn(),
  insertImage: vi.fn(),
  exportPng: vi.fn(),
};

vi.mock("@usememos/canvas/react", () => ({
  Canvas: forwardRef((props: { ariaLabel?: string; readOnly?: boolean; initialScene?: { elements: unknown[] } }, ref) => {
    mocks.canvasProps.push(props);
    useImperativeHandle(ref, () => handle, []);
    return <div role="img" aria-label={props.ariaLabel} />;
  }),
}));
vi.mock("@/components/MemoEditor/edit/services/uploadService", () => ({ uploadService: { uploadFile: mocks.uploadFile } }));
vi.mock("@/hooks/useMemoQueries", () => ({ useUpdateMemo: () => ({ mutateAsync: mocks.updateMemo }) }));
vi.mock("@/connect", () => ({ memoServiceClient: { getMemo: mocks.getMemo } }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => mocks.currentUser }));
vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));

const fixturePng = new Uint8Array(readFileSync(resolve(__dirname, "fixtures/canvas/v1.canvas.png")));
const scene = {
  type: "memos-canvas",
  version: 1,
  elements: [
    {
      id: "r1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      angle: 0,
      strokeColor: "#1a1a1a",
      backgroundColor: "transparent",
      strokeWidth: 2,
      opacity: 100,
      roundness: 8,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      seed: 1,
      locked: false,
    },
  ],
  files: {},
  appState: { viewBackgroundColor: "#fbfaf7", zoom: 1, scrollX: 0, scrollY: 0, handDrawn: false },
} as unknown as Scene;

const author = create(UserSchema, { name: "users/author", role: User_Role.USER });
const drawing = create(AttachmentSchema, {
  name: "attachments/d1",
  creator: author.name,
  filename: "drawing-20261106-101500.canvas.png",
  type: "image/png",
});
const memo = create(MemoSchema, { name: "memos/m1", creator: author.name, attachments: [drawing] });
const withScene = async (value = scene) => new Uint8Array(await insertSceneChunk(fixturePng, value));

/** Edit stays disabled until the drawing's scene has loaded. */
const startEditing = async () => {
  const edit = await screen.findByRole("button", { name: "common.edit" });
  await waitFor(() => expect(edit).toBeEnabled());
  fireEvent.click(edit);
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
});

beforeEach(async () => {
  handle.canUndo.mockReturnValue(false);
  mocks.canvasProps.length = 0;
  mocks.currentUser = author;
  mocks.getMemo.mockResolvedValue(memo);
  handle.getScene.mockReturnValue(scene);
  const bytes = await withScene();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DrawingViewer", () => {
  it("returns focus to the canvas when Edit is no longer available", async () => {
    const props = { attachment: drawing, memo, canEdit: true, onClose: vi.fn(), onNoScene: vi.fn() };
    const { rerender } = render(<DrawingViewer {...props} />);
    await startEditing();
    handle.focus.mockClear();
    rerender(<DrawingViewer {...props} canEdit={false} />);
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    fireEvent.click(await screen.findByRole("button", { name: "editor.drawing.discard" }));
    await waitFor(() => expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true));
    expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
    expect(handle.focus).toHaveBeenCalledOnce();
  });

  it("refreshes available history when entering edit on the retained canvas", async () => {
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={vi.fn()} onNoScene={vi.fn()} />);
    handle.canUndo.mockReturnValue(true);
    await startEditing();
    expect(screen.getByRole("button", { name: "editor.drawing.undo" })).toBeEnabled();
  });

  it.each(["replacement", "copy"])("returns to the accepted scene after abandoning a failed %s update", async (kind) => {
    const source = create(AttachmentSchema, { ...drawing, creator: kind === "replacement" ? author.name : "users/other" });
    const current = create(MemoSchema, { ...memo, attachments: [source] });
    const edited = structuredClone(scene);
    edited.elements[0].x = 30;
    handle.exportPng.mockResolvedValue(new Blob([await withScene(edited)], { type: "image/png" }));
    mocks.getMemo.mockResolvedValue(current);
    mocks.uploadFile.mockResolvedValue(kind === "replacement" ? source : create(AttachmentSchema, { name: "attachments/copy" }));
    mocks.updateMemo.mockRejectedValueOnce(new Error("offline"));
    render(<DrawingViewer attachment={source} memo={current} canEdit onClose={vi.fn()} onNoScene={vi.fn()} />);
    await startEditing();
    const save = screen.getByRole("button", { name: kind === "replacement" ? "common.save" : "editor.drawing.save-copy" });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledOnce());
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    fireEvent.click(await screen.findByRole("button", { name: "editor.drawing.discard" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "common.edit" })).toHaveFocus());
    expect(handle.setScene).toHaveBeenCalledWith(kind === "replacement" ? edited : scene);
    expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true);
  });

  it("keeps the same canvas and restores the accepted drawing when an edit is discarded", async () => {
    const onClose = vi.fn();
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={onClose} onNoScene={vi.fn()} />);
    await startEditing();
    const surface = screen.getByRole("img");
    expect(handle.focus).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    fireEvent.click(await screen.findByRole("button", { name: "editor.drawing.discard" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "common.edit" })).toHaveFocus());
    expect(screen.getByRole("img")).toBe(surface);
    expect(handle.setScene).toHaveBeenCalledWith(scene);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the drawing read-only, with zoom navigation and Edit for the author", async () => {
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={vi.fn()} onNoScene={vi.fn()} />);

    await waitFor(() => expect(mocks.canvasProps.at(-1)?.initialScene?.elements).toHaveLength(1));
    expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "editor.drawing.zoom 100%" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.edit" })).toBeEnabled();
  });

  it("offers no Edit to someone who cannot change the memo", async () => {
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit={false} onClose={vi.fn()} onNoScene={vi.fn()} />);

    await waitFor(() => expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true));
    expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
  });

  it("hands a file without a scene back to the image viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixturePng.slice(0, 33))),
    );
    const onNoScene = vi.fn();
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={vi.fn()} onNoScene={onNoScene} />);

    await waitFor(() => expect(onNoScene).toHaveBeenCalled());
  });

  it("Edit replaces the drawing in place and stamps the memo", async () => {
    const edited = await withScene();
    handle.exportPng.mockResolvedValue(new Blob([edited], { type: "image/png" }));
    mocks.uploadFile.mockResolvedValue(drawing);
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={vi.fn()} onNoScene={vi.fn()} />);

    await startEditing();
    const surface = screen.getByRole("img");
    fireEvent.click(await screen.findByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledWith({ update: { name: memo.name }, updateMask: ["update_time"] }));
    expect(mocks.uploadFile.mock.calls[0][0].replaces).toBe(drawing.name);
    // Back in the viewer, read-only again.
    await waitFor(() => expect(screen.getByRole("button", { name: "common.edit" })).toHaveFocus());
    expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true);
    expect(screen.getByRole("img")).toBe(surface);
  });

  it("adds an edit of someone else's drawing beside it, and a retry reuses the uploaded copy", async () => {
    // The memo's author may change the memo but not replace or remove a file someone else uploaded.
    const othersDrawing = create(AttachmentSchema, { ...drawing, creator: "users/other" });
    const copy = create(AttachmentSchema, { name: "attachments/d2", filename: "drawing-2.canvas.png", type: "image/png" });
    handle.exportPng.mockResolvedValue(new Blob([await withScene()], { type: "image/png" }));
    mocks.getMemo.mockResolvedValue(create(MemoSchema, { ...memo, attachments: [othersDrawing] }));
    mocks.uploadFile.mockResolvedValue(copy);
    mocks.updateMemo.mockRejectedValueOnce(new Error("offline"));
    render(
      <DrawingViewer
        attachment={othersDrawing}
        memo={create(MemoSchema, { ...memo, attachments: [othersDrawing] })}
        canEdit
        onClose={vi.fn()}
        onNoScene={vi.fn()}
      />,
    );

    await startEditing();
    const done = await screen.findByRole("button", { name: "editor.drawing.save-copy" });
    fireEvent.click(done);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile.mock.calls[0][0].replaces).toBeUndefined();
    const [{ update, updateMask }] = mocks.updateMemo.mock.calls[0];
    expect(updateMask).toEqual(["attachments"]);
    // Whole attachments, so the gallery keeps showing them while the update is pending.
    expect(update.attachments.map((item: { name: string; filename: string }) => [item.name, item.filename])).toEqual([
      [othersDrawing.name, othersDrawing.filename],
      [copy.name, copy.filename],
    ]);

    // A failed bind keeps the sheet open; retry binds the existing upload.
    await waitFor(() => expect(done).toBeEnabled());
    fireEvent.click(done);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledTimes(2));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "common.edit" })).toBeInTheDocument());
  });
  it("retries only the timestamp after an acknowledged replacement", async () => {
    handle.exportPng.mockResolvedValue(new Blob([await withScene()], { type: "image/png" }));
    mocks.uploadFile.mockResolvedValue(drawing);
    mocks.updateMemo.mockRejectedValueOnce(new Error("timestamp offline"));
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={vi.fn()} onNoScene={vi.fn()} />);
    await startEditing();
    const save = screen.getByRole("button", { name: "common.save" });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledOnce());
    await waitFor(() => expect(save).toBeEnabled());
    expect(handle.markSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "editor.drawing.saved-needs-update" })).not.toHaveTextContent(
      "editor.drawing.saved-needs-update",
    );
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledTimes(2));
    expect(mocks.uploadFile).toHaveBeenCalledOnce();
  });

  it("annotates a plain image as a copy and binds against current membership", async () => {
    const source = create(AttachmentSchema, { ...drawing, name: "attachments/photo", filename: "photo.png" });
    const concurrent = create(AttachmentSchema, { name: "attachments/concurrent", filename: "elsewhere.txt" });
    const copy = create(AttachmentSchema, { ...drawing, name: "attachments/annotation" });
    mocks.getMemo.mockResolvedValue(create(MemoSchema, { ...memo, attachments: [source, concurrent] }));
    mocks.uploadFile.mockResolvedValue(copy);
    handle.insertImage.mockResolvedValue("background");
    handle.exportPng.mockResolvedValue(new Blob([await withScene()], { type: "image/png" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="), (c) =>
              c.charCodeAt(0),
            ),
          ),
      ),
    );
    render(
      <DrawingViewer
        attachment={source}
        memo={create(MemoSchema, { ...memo, attachments: [source] })}
        canEdit
        annotate
        onClose={vi.fn()}
        onNoScene={vi.fn()}
      />,
    );
    const save = await screen.findByRole("button", { name: "editor.drawing.save-copy" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledOnce());
    expect(mocks.uploadFile.mock.calls[0][0].replaces).toBeUndefined();
    expect(mocks.updateMemo.mock.calls[0][0].update.attachments.map((item: { name: string }) => item.name)).toEqual([
      source.name,
      copy.name,
      concurrent.name,
    ]);
  });
});

describe("drawings in a memo's gallery", () => {
  it("open in the drawing viewer, not the image viewer", async () => {
    const onImagePreview = vi.fn();
    render(<AttachmentGallery visual={[drawing]} onImagePreview={onImagePreview} drawings={{ memo, canEdit: false }} />);

    fireEvent.click(screen.getByRole("button", { name: drawing.filename }));

    expect(await screen.findByRole("dialog", { name: "editor.insert-menu.drawing" })).toBeInTheDocument();
    expect(onImagePreview).not.toHaveBeenCalled();
  });
});
