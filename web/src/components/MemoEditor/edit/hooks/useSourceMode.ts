import type { EditorMode } from "@usememos/editor";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const STORAGE_KEY = "memos-editor-mode";

/** The composer's editing mode, remembered per device and shared by every composer. */
export const useSourceMode = () => useLocalStorage<EditorMode>(STORAGE_KEY, "rich");
