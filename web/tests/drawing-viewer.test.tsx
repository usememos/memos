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
  currentUser: undefined as unknown,
}));

const handle = {
  setTool: vi.fn(),
  setStyle: vi.fn(),
  zoomToFit: vi.fn(),
  canUndo: () => false,
  canRedo: () => false,
  isDirty: () => true,
  markSaved: vi.fn(),
  commitText: vi.fn(),
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
const withScene = async () => new Uint8Array(await insertSceneChunk(fixturePng, scene));

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
  mocks.canvasProps.length = 0;
  mocks.currentUser = author;
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
  it("shows the drawing read-only, with Zoom to fit and Edit for the author", async () => {
    render(<DrawingViewer attachment={drawing} memo={memo} canEdit onClose={vi.fn()} onNoScene={vi.fn()} />);

    await waitFor(() => expect(mocks.canvasProps.at(-1)?.initialScene?.elements).toHaveLength(1));
    expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "editor.drawing.zoom-to-fit" })).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "editor.drawing.done" }));

    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledWith({ update: { name: memo.name }, updateMask: ["update_time"] }));
    expect(mocks.uploadFile.mock.calls[0][0].replaces).toBe(drawing.name);
    // Back in the viewer, read-only again.
    await waitFor(() => expect(screen.getByRole("button", { name: "editor.drawing.zoom-to-fit" })).toBeInTheDocument());
    expect(mocks.canvasProps.at(-1)?.readOnly).toBe(true);
  });

  it("adds an edit of someone else's drawing beside it, and a retry reuses the uploaded copy", async () => {
    // The memo's author may change the memo but not replace or remove a file someone else uploaded.
    const othersDrawing = create(AttachmentSchema, { ...drawing, creator: "users/other" });
    const copy = create(AttachmentSchema, { name: "attachments/d2", filename: "drawing-2.canvas.png", type: "image/png" });
    handle.exportPng.mockResolvedValue(new Blob([await withScene()], { type: "image/png" }));
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
    const done = await screen.findByRole("button", { name: "editor.drawing.done" });
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

    // The memo update failed: the sheet stays open, and Done again replaces the copy it uploaded.
    await waitFor(() => expect(done).toBeEnabled());
    fireEvent.click(done);
    await waitFor(() => expect(mocks.updateMemo).toHaveBeenCalledTimes(2));
    expect(mocks.uploadFile.mock.calls[1][0].replaces).toBe(copy.name);
    await waitFor(() => expect(screen.getByRole("button", { name: "editor.drawing.zoom-to-fit" })).toBeInTheDocument());
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
