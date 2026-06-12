import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import Editor from "../Editor";
import { useBlobUrls, useDragAndDrop } from "../hooks";
import PlainEditor from "../PlainEditor";
import { useEditorContext } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";
import type { EditorController } from "../types/editorController";

/**
 * Hosts one of the two editor implementations behind the EditorController
 * contract, selected by state.ui.editorMode. Mode switching is a markdown
 * handoff: both editors serialize into state.content on every change, so the
 * incoming editor simply initializes from it.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder }, ref) => {
  const { state, actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();
  const mode = state.ui.editorMode;

  // Both editors implement EditorController; the host holds one ref each and
  // routes the parent's single ref to whichever mode is active.
  const wysiwygRef = useRef<EditorController>(null);
  const plainRef = useRef<EditorController>(null);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const getActive = useCallback((): EditorController | null => (modeRef.current === "wysiwyg" ? wysiwygRef.current : plainRef.current), []);

  // Mid-edit mode switches should land the user back in the editor, not on
  // the toolbar button. Skipped on first mount (useMemoInit owns autofocus).
  const previousModeRef = useRef(mode);
  useEffect(() => {
    if (previousModeRef.current === mode) {
      return;
    }
    previousModeRef.current = mode;
    getActive()?.focus();
  }, [mode, getActive]);

  useImperativeHandle(
    ref,
    (): EditorController => ({
      focus: () => getActive()?.focus(),
      hasFocus: () => getActive()?.hasFocus() ?? false,
      isEmpty: () => getActive()?.isEmpty() ?? true,
      getMarkdown: () => getActive()?.getMarkdown() ?? "",
      setMarkdown: (markdown) => getActive()?.setMarkdown(markdown),
      insertMarkdown: (markdown) => getActive()?.insertMarkdown(markdown),
      scrollToCursor: () => getActive()?.scrollToCursor(),
      selectAll: () => getActive()?.selectAll(),
      toggleBold: () => getActive()?.toggleBold(),
      toggleItalic: () => getActive()?.toggleItalic(),
      toggleTaskList: () => getActive()?.toggleTaskList(),
    }),
    [getActive],
  );

  const { dragHandlers } = useDragAndDrop((files: FileList) => {
    const localFiles: LocalFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
      origin: "upload",
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  });

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  const handlePaste = (event: React.ClipboardEvent<Element>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const files: File[] = [];
    if (clipboard.items && clipboard.items.length > 0) {
      for (const item of Array.from(clipboard.items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    } else if (clipboard.files && clipboard.files.length > 0) {
      files.push(...Array.from(clipboard.files));
    }

    if (files.length === 0) return;

    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
      origin: "upload",
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
    event.preventDefault();
  };

  return (
    <div className="w-full flex flex-col flex-1" {...dragHandlers}>
      {mode === "wysiwyg" ? (
        <Editor
          ref={wysiwygRef}
          className="memo-editor-content"
          initialContent={state.content}
          placeholder={placeholder || ""}
          isFocusMode={state.ui.isFocusMode}
          onContentChange={handleContentChange}
          onPaste={handlePaste}
        />
      ) : (
        <PlainEditor
          ref={plainRef}
          className="memo-editor-content"
          initialContent={state.content}
          placeholder={placeholder || ""}
          isFocusMode={state.ui.isFocusMode}
          onContentChange={handleContentChange}
          onPaste={handlePaste}
        />
      )}
    </div>
  );
});

EditorContent.displayName = "EditorContent";
