import { forwardRef } from "react";
import Editor from "../Editor";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorContentProps } from "../types";
import type { EditorController } from "../types/editorController";

// The editor itself is imported eagerly: the memo view needs it on every page, so
// splitting it would only make the composer paint empty for a beat. The session
// around it is what loads lazily (see MemoEditor.tsx).

/**
 * Hosts the Markdown Editor behind the EditorController contract. The
 * editor writes into state.content on every change.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder, sourceMode, onSubmit, onFiles }, ref) => {
  const isSourceMode = sourceMode.isSourceMode;
  const { actions, dispatch } = useEditorContext();
  const content = useEditorSelector((s) => s.content);
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const attachments = useEditorSelector((s) => s.metadata.attachments);

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  return (
    <div className="relative w-full flex flex-col flex-1">
      <Editor
        ref={ref}
        className="memo-editor-content"
        value={content}
        placeholder={placeholder || ""}
        isFocusMode={isFocusMode}
        mode={isSourceMode ? "source" : "rich"}
        attachments={attachments}
        onContentChange={handleContentChange}
        onFiles={onFiles}
        onSubmit={onSubmit}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
