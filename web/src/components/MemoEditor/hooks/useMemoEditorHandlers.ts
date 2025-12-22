import { useCallback } from "react";
import { isValidUrl } from "@/helpers/utils";
import type { EditorRefActions } from "../Editor";
import { hyperlinkHighlightedText } from "../Editor/shortcuts";

export interface UseMemoEditorHandlersOptions {
  editorRef: React.RefObject<EditorRefActions>;
  onContentChange: (content: string) => void;
  onFilesAdded: (files: FileList) => void;
  setComposing: (isComposing: boolean) => void;
}

export interface UseMemoEditorHandlersReturn {
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  handlePasteEvent: (event: React.ClipboardEvent) => Promise<void>;
  handleEditorFocus: () => void;
}

export const useMemoEditorHandlers = (options: UseMemoEditorHandlersOptions): UseMemoEditorHandlersReturn => {
  const { editorRef, onFilesAdded, setComposing } = options;

  const handleCompositionStart = useCallback(() => {
    setComposing(true);
  }, [setComposing]);

  const handleCompositionEnd = useCallback(() => {
    setComposing(false);
  }, [setComposing]);

  const handlePasteEvent = useCallback(
    async (event: React.ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        event.preventDefault();
        onFilesAdded(event.clipboardData.files);
      } else if (
        editorRef.current != null &&
        editorRef.current.getSelectedContent().length !== 0 &&
        isValidUrl(event.clipboardData.getData("Text"))
      ) {
        event.preventDefault();
        hyperlinkHighlightedText(editorRef.current, event.clipboardData.getData("Text"));
      }
    },
    [editorRef, onFilesAdded],
  );

  const handleEditorFocus = useCallback(() => {
    editorRef.current?.focus();
  }, [editorRef]);

  return {
    handleCompositionStart,
    handleCompositionEnd,
    handlePasteEvent,
    handleEditorFocus,
  };
};
