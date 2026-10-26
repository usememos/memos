import type { EditorMode } from "@usememos/editor";
import { useEffect, useRef, useState } from "react";
import { cacheService } from "../services";
import type { EditorController } from "../types/editorController";

interface UseMemoInitOptions {
  editorRef: React.RefObject<EditorController | null>;
  /** The persisted draft's key, under which the caret was remembered. */
  draftKey: string;
  autoFocus?: boolean | (() => boolean);
  /** The mode the editor opens in; a caret saved in the other mode is not restored. */
  mode: EditorMode;
}

/**
 * Once the editor has mounted over its initial draft (see `initialEditorState`), puts
 * the caret back where it was remembered and focuses when asked. `autoFocus` is read
 * after the caret is restored, so a host can decide then whether focus is still wanted.
 */
export const useMemoInit = ({ editorRef, draftKey, autoFocus, mode }: UseMemoInitOptions) => {
  const initializedRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const cachedCursor = cacheService.loadCursor(draftKey, mode);
    let restoreCursorTimer: ReturnType<typeof setTimeout> | undefined;
    if (autoFocus || cachedCursor !== undefined) {
      restoreCursorTimer = setTimeout(() => {
        if (cachedCursor !== undefined) {
          editorRef.current?.setSelection(cachedCursor);
        }
        if (typeof autoFocus === "function" ? autoFocus() : autoFocus) {
          editorRef.current?.focus();
        }
      }, 100);
    }

    setIsInitialized(true);
    return () => {
      if (restoreCursorTimer) {
        clearTimeout(restoreCursorTimer);
      }
    };
  }, [draftKey, autoFocus, mode, editorRef]);

  return { isInitialized };
};
