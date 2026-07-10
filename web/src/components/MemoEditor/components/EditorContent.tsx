import { forwardRef } from "react";
import Editor from "../Editor";
import { useBlobUrls } from "../hooks";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";
import type { EditorController } from "../types/editorController";

// Imported eagerly (not React.lazy): the editor is the always-present compose
// box on the home route, which is already code-split — so deferring the
// CodeMirror bundle separately bought nothing and made the editor paint empty
// for a beat before its placeholder appeared (a visible flicker on load).

/**
 * Hosts the CodeMirror Editor behind the EditorController contract. The
 * editor serializes into state.content on every change and exposes its
 * formatting capability for the focus-mode toolbar.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder, onSubmit }, ref) => {
  const { actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();
  const content = useEditorSelector((s) => s.content);
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);

  const handleFiles = (files: File[]) => {
    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
      origin: "upload",
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  };

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  return (
    <div className="w-full flex flex-col flex-1">
      <Editor
        ref={ref}
        className="memo-editor-content"
        initialContent={content}
        placeholder={placeholder || ""}
        isFocusMode={isFocusMode}
        onContentChange={handleContentChange}
        onFiles={handleFiles}
        onSubmit={onSubmit}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
