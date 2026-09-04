import { create } from "@bufbuild/protobuf";
import { act, render, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoInit } from "@/components/MemoEditor/hooks/useMemoInit";
import { cacheService } from "@/components/MemoEditor/services/cacheService";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/state";
import type { EditorController } from "@/components/MemoEditor/types/editorController";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

const editorRef = { current: null } as RefObject<EditorController | null>;
let getEditorState: ReturnType<typeof useEditorContext>["getState"];

function Probe({ autoFocus }: { autoFocus?: boolean | (() => boolean) }) {
  getEditorState = useEditorContext().getState;
  useMemoInit({
    editorRef,
    username: "users/steven",
    cacheKey: "restored-draft",
    autoFocus,
  });
  return null;
}

describe("useMemoInit", () => {
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
    const key = cacheService.key("users/steven", "restored-draft");
    cacheService.saveNow(key, "An unfinished memo");
    cacheService.saveCursor(key, 5);
    const focus = vi.fn();
    const setCursor = vi.fn();
    editorRef.current = { focus, setCursor } as unknown as EditorController;
    const autoFocus = vi.fn(() => {
      expect(getEditorState().content).toBe("An unfinished memo");
      expect(setCursor).toHaveBeenCalledWith(5);
      return allowed;
    });

    render(
      <EditorProvider>
        <Probe autoFocus={autoFocus} />
      </EditorProvider>,
    );
    expect(autoFocus).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(autoFocus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it("restores uploaded attachment bindings with a new memo draft", async () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/image-one",
      filename: "image.png",
      type: "image/png",
    });
    cacheService.saveNow(cacheService.key("users/steven", "restored-draft"), "![image](/file/attachments/image-one)", [attachment]);

    render(
      <EditorProvider>
        <Probe />
      </EditorProvider>,
    );

    await waitFor(() => {
      expect(getEditorState().content).toBe("![image](/file/attachments/image-one)");
      expect(getEditorState().metadata.attachments).toEqual([attachment]);
    });
  });
});
