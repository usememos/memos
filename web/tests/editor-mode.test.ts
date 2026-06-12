import { beforeEach, describe, expect, it } from "vitest";
import { getPreferredEditorMode, setPreferredEditorMode } from "@/components/MemoEditor/editorMode";
import { editorReducer } from "@/components/MemoEditor/state/reducer";
import { createInitialState } from "@/components/MemoEditor/state/types";

describe("editor mode preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to wysiwyg", () => {
    expect(getPreferredEditorMode()).toBe("wysiwyg");
  });

  it("persists raw mode", () => {
    setPreferredEditorMode("raw");
    expect(getPreferredEditorMode()).toBe("raw");
    expect(localStorage.getItem("memos-editor-mode")).toBe("raw");
  });

  it("ignores garbage values", () => {
    localStorage.setItem("memos-editor-mode", "weird");
    expect(getPreferredEditorMode()).toBe("wysiwyg");
  });
});

describe("editor mode in reducer", () => {
  beforeEach(() => localStorage.clear());

  it("RESET re-reads the persisted preference", () => {
    setPreferredEditorMode("raw");
    const state = editorReducer(createInitialState(), { type: "SET_EDITOR_MODE", payload: "wysiwyg" });
    const reset = editorReducer(state, { type: "RESET" });
    expect(reset.ui.editorMode).toBe("raw");
  });
});
