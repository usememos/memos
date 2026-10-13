import { forwardRef } from "react";
import Editor from "../Editor";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorContentProps } from "../types";
import type { EditorController } from "../types/editorController";

// Imported eagerly (not React.lazy): the editor is the always-present compose
// box on the home route, which is already code-split — so deferring the
// editor bundle separately bought nothing and made the editor paint empty
// for a beat before its placeholder appeared (a visible flicker on load).

/**
 * Hosts the Markdown Editor behind the EditorController contract. The
 * editor writes into state.content on every change.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder, onSubmit, onFiles, tagsSetting }, ref) => {
  const { actions, dispatch } = useEditorContext();
  const content = useEditorSelector((s) => s.content);
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const attachments = useEditorSelector((s) => s.metadata.attachments);

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  return (
    <div className="w-full flex flex-col flex-1">
      <Editor
        ref={ref}
        className="memo-editor-content"
        value={content}
        placeholder={placeholder || ""}
        isFocusMode={isFocusMode}
        attachments={attachments}
        tagsSetting={tagsSetting}
        onContentChange={handleContentChange}
        onFiles={onFiles}
        onSubmit={onSubmit}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
