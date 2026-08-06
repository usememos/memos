import { fireEvent, render, screen } from "@testing-library/react";
import { type CSSProperties, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SidebarResizeHandle from "@/components/AppSidebar/SidebarResizeHandle";
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_WIDTH_VAR } from "@/components/AppSidebar/useSidebarWidth";

// The handle's contract has two halves. Keyboard and double-click go straight through
// `onWidthChange`. A pointer drag deliberately does not: it writes the width custom property
// on the layout shell every frame and commits to React exactly once, on release, so that
// dragging does not re-render the sidebar and the memo feed on every pointer move. Both
// halves are asserted here, since the drag half is invisible to a props-only test.

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

// Mirrors how RootLayout wires the handle: the shell owns the custom property and the rail's
// handle writes to it. `railMounted` stands in for RootLayout's `md &&` gate, which unmounts the
// rail — and with it the handle — when the window drops below the desktop breakpoint, while the
// shell itself stays mounted.
const Harness = ({ onWidthChange = vi.fn(), railMounted = true }: { onWidthChange?: (width: number) => void; railMounted?: boolean }) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);

  return (
    <div ref={targetRef} data-testid="shell" style={{ [SIDEBAR_WIDTH_VAR]: `${width}px` } as CSSProperties}>
      {railMounted && (
        <SidebarResizeHandle
          width={width}
          minWidth={SIDEBAR_MIN_WIDTH}
          maxWidth={SIDEBAR_MAX_WIDTH}
          onWidthChange={(next) => {
            setWidth(next);
            onWidthChange(next);
          }}
          targetRef={targetRef}
        />
      )}
    </div>
  );
};

const shellWidthVar = () => screen.getByTestId("shell").style.getPropertyValue(SIDEBAR_WIDTH_VAR);

// Frames are queued rather than run inline: a synchronous requestAnimationFrame would
// misrepresent the platform, running the callback before the handle it returns is stored
// and so defeating the very coalescing these tests exercise.
let frameQueue: FrameRequestCallback[] = [];

const flushFrames = () => {
  const queued = frameQueue;
  frameQueue = [];
  for (const callback of queued) callback(0);
};

const movePointer = (clientX: number) => {
  fireEvent.pointerMove(screen.getByRole("separator"), { pointerId: 1, clientX });
  flushFrames();
};

const drag = (from: number, to: number) => {
  const handle = screen.getByRole("separator");
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: from });
  movePointer(to);
  return handle;
};

describe("<SidebarResizeHandle />", () => {
  beforeEach(() => {
    // jsdom ships PointerEvent but not pointer capture. `vi.spyOn` cannot stand in for a method
    // that does not exist at all, so these are plain assignments — undone in afterEach.
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    Element.prototype.releasePointerCapture = vi.fn();
    frameQueue = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frameQueue.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {
      frameQueue = [];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Prototype assignments outlive `restoreMocks`, so drop them rather than leaning on
    // Vitest's per-file isolation to hide the leak.
    for (const method of ["setPointerCapture", "hasPointerCapture", "releasePointerCapture"]) {
      Reflect.deleteProperty(Element.prototype, method);
    }
  });

  it("exposes splitter semantics with the current width and its bounds", () => {
    render(<Harness />);

    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", String(SIDEBAR_DEFAULT_WIDTH));
    expect(handle).toHaveAttribute("aria-valuemin", String(SIDEBAR_MIN_WIDTH));
    expect(handle).toHaveAttribute("aria-valuemax", String(SIDEBAR_MAX_WIDTH));
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("nudges the width with the arrow keys", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);
    const handle = screen.getByRole("separator");

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onWidthChange).toHaveBeenLastCalledWith(SIDEBAR_DEFAULT_WIDTH + 16);

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onWidthChange).toHaveBeenLastCalledWith(SIDEBAR_DEFAULT_WIDTH);
  });

  it("jumps to each bound with Home and End", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);
    const handle = screen.getByRole("separator");

    fireEvent.keyDown(handle, { key: "Home" });
    expect(onWidthChange).toHaveBeenLastCalledWith(SIDEBAR_MIN_WIDTH);

    fireEvent.keyDown(handle, { key: "End" });
    expect(onWidthChange).toHaveBeenLastCalledWith(SIDEBAR_MAX_WIDTH);
  });

  it("claims the arrow keys so they do not also scroll the page", () => {
    render(<Harness />);

    const prevented = !fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });

    expect(prevented).toBe(true);
  });

  it("ignores keys it does not handle", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);

    const notPrevented = fireEvent.keyDown(screen.getByRole("separator"), { key: "Enter" });

    expect(onWidthChange).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it("resets to the default width on double click", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);
    const handle = screen.getByRole("separator");

    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.doubleClick(handle);

    expect(onWidthChange).toHaveBeenLastCalledWith(SIDEBAR_DEFAULT_WIDTH);
  });

  it("previews a drag through the custom property and commits once on release", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);

    const handle = drag(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 60);

    // Mid-drag the layout has already moved, but React has not been told.
    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH + 60}px`);
    expect(onWidthChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 60 });

    expect(onWidthChange).toHaveBeenCalledTimes(1);
    expect(onWidthChange).toHaveBeenCalledWith(SIDEBAR_DEFAULT_WIDTH + 60);
  });

  it("tracks the pointer delta rather than its absolute position", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);

    // Grabbing the strip off-centre must not snap the rail's edge onto the cursor.
    const handle = drag(SIDEBAR_DEFAULT_WIDTH + 3, SIDEBAR_DEFAULT_WIDTH + 43);
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 43 });

    expect(onWidthChange).toHaveBeenCalledWith(SIDEBAR_DEFAULT_WIDTH + 40);
  });

  it("clamps a drag to the bounds while previewing", () => {
    render(<Harness />);

    drag(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 500);
    expect(shellWidthVar()).toBe(`${SIDEBAR_MAX_WIDTH}px`);

    movePointer(SIDEBAR_DEFAULT_WIDTH - 500);
    expect(shellWidthVar()).toBe(`${SIDEBAR_MIN_WIDTH}px`);
  });

  it("coalesces several moves within one frame into a single write", () => {
    render(<Harness />);
    const handle = screen.getByRole("separator");
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH });

    // A real pointer emits many moves per frame; only the newest position should reach the DOM.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 20 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 30 });
    expect(frameQueue).toHaveLength(1);

    flushFrames();
    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH + 30}px`);
  });

  it("holds the resize cursor for the whole gesture and restores it after", () => {
    render(<Harness />);

    const handle = drag(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 20);
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 20 });
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("commits and cleans up when a drag is cancelled", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);

    const handle = drag(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 24);
    fireEvent.pointerCancel(handle, { pointerId: 1 });

    expect(onWidthChange).toHaveBeenCalledWith(SIDEBAR_DEFAULT_WIDTH + 24);
    expect(document.body.style.cursor).toBe("");
  });

  it("reverts the preview when a drag is interrupted by the rail unmounting", () => {
    const onWidthChange = vi.fn();
    const { rerender } = render(<Harness onWidthChange={onWidthChange} />);

    drag(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 60);
    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH + 60}px`);

    // The window crosses below the desktop breakpoint mid-drag, so no pointerup ever arrives.
    rerender(<Harness onWidthChange={onWidthChange} railMounted={false} />);

    // Nothing was committed, so the shell must not keep displaying the previewed width.
    expect(onWidthChange).not.toHaveBeenCalled();
    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH}px`);
  });

  it("leaves the committed width alone when the rail unmounts outside a drag", () => {
    const onWidthChange = vi.fn();
    const { rerender } = render(<Harness onWidthChange={onWidthChange} />);

    const handle = drag(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 60);
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 60 });
    rerender(<Harness onWidthChange={onWidthChange} railMounted={false} />);

    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH + 60}px`);
  });

  it("ignores pointer movement that did not start on the handle", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);
    const handle = screen.getByRole("separator");

    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 900 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 900 });

    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH}px`);
    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it("ignores non-primary buttons so a right click cannot start a drag", () => {
    const onWidthChange = vi.fn();
    render(<Harness onWidthChange={onWidthChange} />);
    const handle = screen.getByRole("separator");

    fireEvent.pointerDown(handle, { button: 2, pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: SIDEBAR_DEFAULT_WIDTH + 60 });

    expect(shellWidthVar()).toBe(`${SIDEBAR_DEFAULT_WIDTH}px`);
    expect(onWidthChange).not.toHaveBeenCalled();
  });
});
