import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { insertSceneChunk, type Scene } from "@usememos/canvas";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { isDrawingFilename } from "@/components/DrawingSheet";
import { useDrawing } from "@/components/MemoEditor/edit/hooks";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/edit/state";
import type { LocalFile } from "@/components/MemoEditor/edit/types/attachment";
import AttachmentListEditor from "@/components/MemoMetadata/Attachment/AttachmentListEditor";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import { User_Role, UserSchema } from "@/types/proto/api/user_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";

const auth = vi.hoisted(() => ({ currentUser: undefined as unknown }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => auth.currentUser }));

// A 4 × 4 PNG exported by @usememos/canvas (its tests/fixtures/png/v1.canvas.png).
const fixturePng = new Uint8Array(readFileSync(resolve(__dirname, "fixtures/canvas/v1.canvas.png")));

const artist = create(UserSchema, { name: "users/artist", role: User_Role.USER });

const drawingAttachment = create(AttachmentSchema, {
  name: "attachments/drawing1",
  creator: artist.name,
  filename: "drawing-20261106-101500.canvas.png",
  type: "image/png",
  size: BigInt(fixturePng.byteLength),
});

/** A scene with one of each kind of mark, as the sheet's Done would export it. */
const scene = {
  type: "memos-canvas",
  version: 1,
  elements: [
    {
      id: "r1",
      type: "rectangle",
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      angle: 0,
      strokeColor: "#1e1e1e",
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
    {
      id: "f1",
      type: "freedraw",
      x: 0,
      y: 140,
      width: 60,
      height: 12,
      angle: 0,
      strokeColor: "#e03131",
      backgroundColor: "transparent",
      strokeWidth: 4,
      opacity: 100,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      seed: 2,
      locked: false,
      points: [
        [0, 0, 0.5],
        [30, 12, 0.6],
        [60, 0, 0.5],
      ],
      simulatePressure: false,
    },
    {
      id: "t1",
      type: "text",
      x: 30,
      y: 50,
      width: 60,
      height: 25,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      strokeWidth: 2,
      opacity: 100,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      seed: 3,
      locked: false,
      text: "Idea",
      fontSize: 20,
      fontFamily: "system-ui",
      textAlign: "left",
      autoWidth: true,
      containerId: null,
    },
  ],
  files: {},
  appState: { viewBackgroundColor: "#ffffff", zoom: 1, scrollX: 0, scrollY: 0, handDrawn: false },
} as unknown as Scene;

/** A PNG with the scene embedded, as the sheet's Done exports it. */
const exportDrawing = async () => new Uint8Array(await insertSceneChunk(fixturePng, scene));

const toLocalFile = (file: File): LocalFile => ({ file, previewUrl: `blob:${file.name}`, origin: "upload" });

const wrapper = ({ children }: { children: ReactNode }) => <EditorProvider>{children}</EditorProvider>;
const renderDrawing = () =>
  renderHook(
    () => {
      const editor = useEditorContext();
      return { drawing: useDrawing(toLocalFile), editor };
    },
    { wrapper },
  );

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  auth.currentUser = artist;
});

auth.currentUser = artist;

describe("drawing attachments", () => {
  it("recognizes drawings by their file name", () => {
    expect(isDrawingFilename("drawing-20261106-101500.canvas.png")).toBe(true);
    expect(isDrawingFilename("Sketch.CANVAS.PNG")).toBe(true);
    expect(isDrawingFilename("photo.png")).toBe(false);
  });

  it("offers Edit drawing only on drawings this server stores", () => {
    const onEditDrawing = vi.fn();
    const photo = create(AttachmentSchema, { name: "attachments/photo", filename: "photo.png", type: "image/png" });
    const linked = create(AttachmentSchema, {
      name: "attachments/linked",
      filename: "drawing-20261101-093000.canvas.png",
      type: "image/png",
      externalLink: "https://example.com/drawing.canvas.png",
    });
    const local = toLocalFile(new File([fixturePng], "drawing-20261106-120000.canvas.png", { type: "image/png" }));
    render(<AttachmentListEditor attachments={[drawingAttachment, photo, linked]} localFiles={[local]} onEditDrawing={onEditDrawing} />);

    const actions = screen.getAllByRole("button", { name: "Edit drawing" });
    expect(actions).toHaveLength(2);
    fireEvent.click(actions[0]);
    expect(onEditDrawing).toHaveBeenLastCalledWith({ kind: "attachment", attachment: drawingAttachment });
    fireEvent.click(actions[1]);
    expect(onEditDrawing).toHaveBeenLastCalledWith({ kind: "local", localFile: local });
  });

  it("keeps only the glyph of Edit drawing on narrow rows", () => {
    const wide = window.matchMedia;
    window.matchMedia = (() => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
    try {
      const onEditDrawing = vi.fn();
      render(<AttachmentListEditor attachments={[drawingAttachment]} onEditDrawing={onEditDrawing} />);
      const action = screen.getByRole("button", { name: "Edit drawing" });
      expect(action).not.toHaveTextContent("Edit drawing");
      fireEvent.click(action);
      expect(onEditDrawing).toHaveBeenCalledWith({ kind: "attachment", attachment: drawingAttachment });
    } finally {
      window.matchMedia = wide;
    }
  });

  it("Edit drawing downloads the original file, not the thumbnail", async () => {
    const fetchMock = vi.fn(async () => new Response(fixturePng));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderDrawing();

    await act(() => result.current.drawing.openExisting({ kind: "attachment", attachment: drawingAttachment }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(getAttachmentUrl(drawingAttachment));
    expect(url).not.toContain("thumbnail");
    expect(result.current.drawing.session).toMatchObject({ mode: "edit", target: { kind: "attachment", name: drawingAttachment.name } });
  });

  it("reopens a saved drawing with the same elements, and Done replaces it in the draft", async () => {
    // Done exports a PNG with the scene inside; the upload stores the bytes unchanged and the
    // file route serves them back, so the reload sees exactly what Done produced.
    const exported = await exportDrawing();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(exported)),
    );
    const { result } = renderDrawing();
    act(() => result.current.editor.dispatch(result.current.editor.actions.setMetadata({ attachments: [drawingAttachment] })));

    await act(() => result.current.drawing.openExisting({ kind: "attachment", attachment: drawingAttachment }));

    const reopened = result.current.drawing.session?.scene;
    expect(reopened?.elements.map((element) => [element.id, element.type])).toEqual([
      ["r1", "rectangle"],
      ["f1", "freedraw"],
      ["t1", "text"],
    ]);
    expect(reopened?.elements).toEqual(scene.elements.map((element) => expect.objectContaining(element)));

    const edited = new File([exported], "drawing-20261106-130000.canvas.png", { type: "image/png" });
    act(() => result.current.drawing.done(edited));

    // The saved drawing keeps its place; the edit waits to upload over it on save.
    const state = result.current.editor.getState();
    expect(state.metadata.attachments).toEqual([drawingAttachment]);
    expect(state.localFiles.map((item) => [item.file.name, item.replaces])).toEqual([
      ["drawing-20261106-130000.canvas.png", drawingAttachment.name],
    ]);
    expect(result.current.drawing.session).toBeUndefined();

    // Editing the pending edit again keeps it a replacement of the same attachment.
    await act(() => result.current.drawing.openExisting({ kind: "local", localFile: state.localFiles[0] }));
    act(() => result.current.drawing.done(new File([exported], "drawing-20261106-140000.canvas.png", { type: "image/png" })));
    expect(result.current.editor.getState().localFiles.map((item) => [item.file.name, item.replaces])).toEqual([
      ["drawing-20261106-140000.canvas.png", drawingAttachment.name],
    ]);
  });

  it("shows a pending edit in place of the saved drawing it replaces", () => {
    const edit: LocalFile = {
      ...toLocalFile(new File([fixturePng], "drawing-20261106-130000.canvas.png", { type: "image/png" })),
      replaces: drawingAttachment.name,
    };
    const onOrderChange = vi.fn();
    const photo = create(AttachmentSchema, { name: "attachments/photo", filename: "photo.png", type: "image/png" });
    const map = create(AttachmentSchema, { name: "attachments/map", filename: "map.png", type: "image/png" });
    render(
      <AttachmentListEditor
        attachments={[drawingAttachment, photo, map]}
        localFiles={[edit]}
        onOrderChange={onOrderChange}
        onEditDrawing={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: `Preview ${drawingAttachment.filename}` })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview drawing-20261106-130000.canvas.png" })).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
    // Moving the edit moves the saved drawing it stands in for: its key is the attachment's name.
    fireEvent.keyDown(screen.getByRole("button", { name: "Preview drawing-20261106-130000.canvas.png" }), {
      key: "ArrowRight",
      altKey: true,
    });
    expect(onOrderChange).toHaveBeenLastCalledWith([photo.name, drawingAttachment.name, map.name]);
  });

  it("does not offer Insert image on a pending edit of a saved drawing", () => {
    const edit: LocalFile = {
      ...toLocalFile(new File([fixturePng], "drawing-20261106-130000.canvas.png", { type: "image/png" })),
      replaces: drawingAttachment.name,
    };
    const fresh = toLocalFile(new File([fixturePng], "drawing-20261106-140000.canvas.png", { type: "image/png" }));
    render(<AttachmentListEditor attachments={[drawingAttachment]} localFiles={[edit, fresh]} onInsertLocalFiles={vi.fn()} />);

    // Inserting uploads at once, which would overwrite the saved drawing before the memo is saved.
    expect(screen.getAllByRole("button", { name: "Insert image" })).toHaveLength(1);
  });

  it("starting a new drawing drops a drawing still downloading", async () => {
    let finishDownload: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (finishDownload = resolve))),
    );
    const { result } = renderDrawing();

    let opening: Promise<void> = Promise.resolve();
    act(() => {
      opening = result.current.drawing.openExisting({ kind: "attachment", attachment: drawingAttachment });
    });
    expect(result.current.drawing.opening).toBe(drawingAttachment.name);
    act(() => result.current.drawing.openNew());
    const fresh = result.current.drawing.session;
    expect(result.current.drawing.opening).toBeUndefined();

    await act(async () => {
      finishDownload(new Response(await exportDrawing()));
      await opening;
    });
    expect(result.current.drawing.session).toBe(fresh);
  });

  it("adds an edit of someone else's drawing beside it, keeping the original", async () => {
    auth.currentUser = create(UserSchema, { name: "users/author", role: User_Role.USER });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(await exportDrawing())),
    );
    const { result } = renderDrawing();
    act(() => result.current.editor.dispatch(result.current.editor.actions.setMetadata({ attachments: [drawingAttachment] })));

    await act(() => result.current.drawing.openExisting({ kind: "attachment", attachment: drawingAttachment }));
    act(() => result.current.drawing.done(new File([fixturePng], "drawing-2.canvas.png", { type: "image/png" })));

    // Only its uploader or an admin may remove it from the memo.
    const state = result.current.editor.getState();
    expect(state.metadata.attachments).toEqual([drawingAttachment]);
    expect(state.localFiles.map((item) => [item.file.name, item.replaces])).toEqual([["drawing-2.canvas.png", undefined]]);
  });

  it("swaps an edited local drawing in place and opens a picture without a scene as a background", async () => {
    const first = toLocalFile(new File([await exportDrawing()], "drawing-1.canvas.png", { type: "image/png" }));
    const plain = toLocalFile(new File([fixturePng.slice(0, 33)], "drawing-2.canvas.png", { type: "image/png" }));
    const { result } = renderDrawing();
    act(() => result.current.editor.dispatch(result.current.editor.actions.setLocalFiles([first, plain])));

    await act(() => result.current.drawing.openExisting({ kind: "local", localFile: first }));
    act(() => result.current.drawing.done(new File([fixturePng], "drawing-3.canvas.png", { type: "image/png" })));
    expect(result.current.editor.getState().localFiles.map((item) => item.file.name)).toEqual([
      "drawing-3.canvas.png",
      "drawing-2.canvas.png",
    ]);

    await act(() => result.current.drawing.openExisting({ kind: "local", localFile: plain }));
    await waitFor(() => expect(result.current.drawing.session?.background).toBeInstanceOf(Blob));
    expect(result.current.drawing.session).toMatchObject({ mode: "new", target: { kind: "new" } });
  });
});
