export type EditorMode = "wysiwyg" | "raw";

const STORAGE_KEY = "memos-editor-mode";

/** Per-device editor mode preference. WYSIWYG is the default for everyone. */
export function getPreferredEditorMode(): EditorMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "raw" ? "raw" : "wysiwyg";
  } catch {
    return "wysiwyg";
  }
}

export function setPreferredEditorMode(mode: EditorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (e.g. blocked storage) — preference won't persist.
  }
}
