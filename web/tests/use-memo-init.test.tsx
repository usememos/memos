import { create } from "@bufbuild/protobuf";
import { act, render } from "@testing-library/react";
import type { EditorMode } from "@usememos/editor";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoInit } from "@/components/MemoEditor/edit/hooks/useMemoInit";
import { initialEditorState } from "@/components/MemoEditor/edit/initialState";
import { cacheService } from "@/components/MemoEditor/edit/services/cacheService";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/edit/state";
import type { EditorController } from "@/components/MemoEditor/edit/types/editorController";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import { type Location, LocationSchema, MemoSchema, Visibility } from "@/types/proto/api/memo_service_pb";

const editorRef = { current: null } as RefObject<EditorController | null>;
const draftKey = cacheService.key("users/steven", "restored-draft");
let getEditorState: ReturnType<typeof useEditorContext>["getState"];

function Probe({ autoFocus, mode = "rich" }: { autoFocus?: boolean | (() => boolean); mode?: EditorMode }) {
  getEditorState = useEditorContext().getState;
  useMemoInit({ editorRef, draftKey, autoFocus, mode });
  return null;
}

/** Mounts a session the way MemoEditor does: the draft read once, then the caret restored. */
const mountSession = (props: {
  autoFocus?: boolean | (() => boolean);
  mode?: EditorMode;
  defaultLocation?: Location;
  canChooseSpace?: boolean;
}) =>
  render(
    <EditorProvider
      initialEditorState={initialEditorState({
        draftKey,
        defaultVisibility: Visibility.PUBLIC,
        defaultLocation: props.defaultLocation,
        canChooseSpace: props.canChooseSpace,
      })}
    >
      <Probe autoFocus={props.autoFocus} mode={props.mode} />
    </EditorProvider>,
  );

describe("the initial draft and useMemoInit", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
    cacheService.clearAll();
  });

  afterEach(() => {
    editorRef.current = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([true, false])("restores the draft and cursor before evaluating autofocus (%s)", (allowed) => {
    vi.useFakeTimers();
    cacheService.saveNow(draftKey, { content: "An unfinished memo", attachments: [] });
    const selection = { anchor: { block: 0, offset: 5 }, focus: { block: 0, offset: 5 } };
    cacheService.saveCursor(draftKey, selection, "rich");
    const focus = vi.fn();
    const setSelection = vi.fn();
    editorRef.current = { focus, setSelection } as unknown as EditorController;
    const autoFocus = vi.fn(() => {
      expect(getEditorState().content).toBe("An unfinished memo");
      expect(setSelection).toHaveBeenCalledWith(selection);
      return allowed;
    });

    mountSession({ autoFocus });
    expect(getEditorState().content).toBe("An unfinished memo");
    expect(autoFocus).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(autoFocus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it("does not restore a cursor taken in the other editor mode", () => {
    vi.useFakeTimers();
    cacheService.saveNow(draftKey, { content: "An unfinished memo", attachments: [] });
    cacheService.saveCursor(draftKey, { anchor: { block: 0, offset: 12 }, focus: { block: 0, offset: 12 } }, "source");
    const setSelection = vi.fn();
    editorRef.current = { focus: vi.fn(), setSelection } as unknown as EditorController;

    mountSession({ mode: "rich" });
    act(() => vi.advanceTimersByTime(100));
    expect(getEditorState().content).toBe("An unfinished memo");
    expect(setSelection).not.toHaveBeenCalled();
  });

  it("seeds a new location once and honors a restored removal", () => {
    const point = create(LocationSchema, { latitude: 35, longitude: 135, placeholder: "Cafe" });
    const { unmount } = mountSession({ defaultLocation: point });
    expect(getEditorState().metadata.location).toEqual(point);
    unmount();
    cacheService.saveNow(draftKey, { content: "Draft without a location", attachments: [], location: null });
    mountSession({ defaultLocation: point });
    expect(getEditorState().metadata.location).toBeUndefined();
  });

  it.each([true, false])("restores destination only when the composer can choose a Space (%s)", (canChooseSpace) => {
    cacheService.saveNow(draftKey, {
      content: "Draft",
      attachments: [],
      location: null,
      space: "spaces/work",
      visibility: Visibility.PRIVATE,
    });
    mountSession({ canChooseSpace });
    expect(getEditorState().metadata.space).toBe(canChooseSpace ? "spaces/work" : undefined);
    expect(getEditorState().metadata.visibility).toBe(Visibility.PRIVATE);
  });

  it("restores uploaded attachment bindings with a new memo draft", () => {
    const attachment = create(AttachmentSchema, { name: "attachments/image-one", filename: "image.png", type: "image/png" });
    cacheService.saveNow(draftKey, { content: "![image](/file/attachments/image-one)", attachments: [attachment] });

    mountSession({});

    expect(getEditorState().content).toBe("![image](/file/attachments/image-one)");
    expect(getEditorState().metadata.attachments).toEqual([attachment]);
  });

  it("starts an edit from the memo and drops any draft under its key", () => {
    cacheService.saveNow(draftKey, { content: "stale draft", attachments: [] });
    const memo = create(MemoSchema, { name: "memos/one", content: "The memo", visibility: Visibility.PUBLIC, space: "spaces/work" });

    const state = initialEditorState({ memo, draftKey, initialFocusMode: true });

    expect(state.content).toBe("The memo");
    expect(state.metadata.space).toBe("spaces/work");
    expect(state.ui.isFocusMode).toBe(true);
    expect(cacheService.loadDraft(draftKey).content).toBe("");
  });
});
