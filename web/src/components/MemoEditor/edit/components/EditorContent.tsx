import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
export const EditorContent = forwardRef<EditorController, EditorContentProps>(
  ({ placeholder, sourceMode, onSubmit, onFiles, onUserTextInput }, ref) => {
    const inputTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const composing = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const onUserTextInputRef = useRef(onUserTextInput);
    useLayoutEffect(() => {
      onUserTextInputRef.current = onUserTextInput;
    });
    useEffect(() => () => clearTimeout(inputTimer.current), []);

    // Wait until the editor has processed the browser event before changing its layout.
    const scheduleUserInput = useCallback(() => {
      clearTimeout(inputTimer.current);
      inputTimer.current = setTimeout(() => onUserTextInputRef.current?.(), 0);
    }, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      // The editor handles beforeinput itself, so the browser may never emit input.
      const handleBeforeInput = (event: InputEvent) => {
        if (!composing.current && !event.isComposing && event.inputType.startsWith("insert")) scheduleUserInput();
      };
      container.addEventListener("beforeinput", handleBeforeInput, true);
      return () => container.removeEventListener("beforeinput", handleBeforeInput, true);
    }, [scheduleUserInput]);

    const isSourceMode = sourceMode.isSourceMode;
    const { actions, dispatch } = useEditorContext();
    const content = useEditorSelector((s) => s.content);
    const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
    const attachments = useEditorSelector((s) => s.metadata.attachments);

    const handleContentChange = (content: string) => {
      dispatch(actions.updateContent(content));
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full flex flex-col flex-1"
        onPasteCapture={(event) => {
          if (!composing.current && event.clipboardData.getData("text/plain")) scheduleUserInput();
        }}
        onCompositionStartCapture={() => {
          composing.current = true;
          clearTimeout(inputTimer.current);
        }}
        onCompositionEndCapture={(event) => {
          composing.current = false;
          if (event.data) scheduleUserInput();
        }}
        onInputCapture={(event) => {
          const input = event.nativeEvent as InputEvent;
          if (!composing.current && !input.isComposing && input.inputType?.startsWith("insert")) scheduleUserInput();
        }}
      >
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
  },
);

EditorContent.displayName = "EditorContent";
