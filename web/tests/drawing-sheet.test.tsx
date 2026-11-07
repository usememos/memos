import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useLayoutEffect } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DrawingSheet from "@/components/DrawingSheet/DrawingSheet";

const calls: string[] = [];
const handle = {
  setTool: vi.fn(),
  setStyle: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
  zoomToFit: vi.fn(),
  insertImage: vi.fn(async () => "image1"),
  markSaved: vi.fn(),
  isDirty: vi.fn(() => false),
  commitText: vi.fn(() => calls.push("commitText")),
  exportPng: vi.fn(async () => {
    calls.push("exportPng");
    return new Blob(["png"], { type: "image/png" });
  }),
};

// Like the real component, the handle is attached before the engine exists and throws
// until the component's own layout effect has created it.
let mounted = false;
vi.mock("@usememos/canvas/react", () => ({
  Canvas: forwardRef((props: { ariaLabel?: string }, ref) => {
    useImperativeHandle(
      ref,
      () =>
        new Proxy(handle, {
          get: (target, key) => {
            if (!mounted) throw new Error(`Canvas is not mounted (${String(key)})`);
            return target[key as keyof typeof target];
          },
        }),
      [],
    );
    useLayoutEffect(() => {
      mounted = true;
      return () => {
        mounted = false;
      };
    }, []);
    return <div role="img" aria-label={props.ariaLabel} tabIndex={0} />;
  }),
}));

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
});

beforeEach(() => {
  calls.length = 0;
  handle.isDirty.mockReturnValue(false);
  handle.canUndo.mockReturnValue(false);
  handle.canRedo.mockReturnValue(false);
  handle.insertImage.mockResolvedValue("image1");
  handle.exportPng.mockImplementation(async () => {
    calls.push("exportPng");
    return new Blob(["png"], { type: "image/png" });
  });
  handle.commitText.mockImplementation(() => calls.push("commitText"));
});

describe("DrawingSheet", () => {
  it("keeps typed text, exports and hands back a named PNG on Done", async () => {
    const onDone = vi.fn();
    render(<DrawingSheet mode="new" onDone={onDone} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "editor.drawing.done" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(["commitText", "exportPng"]);
    const file = onDone.mock.calls[0][0] as File;
    expect(file.type).toBe("image/png");
    expect(file.name).toMatch(/^drawing-\d{8}-\d{6}\.canvas\.png$/);
  });

  it("closes at once when nothing changed, and asks first when the drawing has changes", async () => {
    const onClose = vi.fn();
    const { unmount } = render(<DrawingSheet mode="new" onDone={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockClear();
    handle.isDirty.mockReturnValue(true);
    render(<DrawingSheet mode="edit" onDone={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(await screen.findByText("editor.drawing.discard-edit-title")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "editor.drawing.discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("drives the canvas from the toolbar", () => {
    render(<DrawingSheet mode="new" onDone={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "editor.drawing.tool-rectangle" }));
    expect(handle.setTool).toHaveBeenLastCalledWith("rectangle");
    expect(screen.getByRole("button", { name: "editor.drawing.tool-rectangle" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "editor.drawing.zoom-to-fit" }));
    expect(handle.zoomToFit).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "editor.drawing.undo" })).toBeDisabled();
  });

  it("enables Undo as soon as a stroke ends, without waiting for the debounced change", () => {
    render(<DrawingSheet mode="new" onDone={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "editor.drawing.undo" })).toBeDisabled();

    handle.canUndo.mockReturnValue(true);
    fireEvent.pointerUp(screen.getByRole("img", { name: "editor.drawing.new-title" }));

    expect(screen.getByRole("button", { name: "editor.drawing.undo" })).toBeEnabled();
  });

  it("opens a picture without a scene as a locked background", async () => {
    const picture = new Blob(["png"], { type: "image/png" });
    render(<DrawingSheet mode="new" background={picture} onDone={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => expect(handle.insertImage).toHaveBeenCalledWith(picture, { background: true }));
    await waitFor(() => expect(handle.markSaved).toHaveBeenCalled());
  });
});
