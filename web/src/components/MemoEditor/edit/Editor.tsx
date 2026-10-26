import type { EditorMode, Editor as MarkdownEditorInstance } from "@usememos/editor";
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { useTagCounts } from "@/hooks/useUserQueries";
import { MEMO_FOCUS_EDITOR_THEME } from "@/lib/memo-markdown";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";
import { MemoMarkdown } from "../MemoMarkdown";
import { createController } from "./controller";
import type { EditorController } from "./types/editorController";
import "./editor.css";
import { buildEditorExtensions, type EditorFileOrigin } from "./extensions";

interface EditorProps {
  className: string;
  /** The document. The editor applies a value only when it is not one the editor emitted itself. */
  value: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onFiles: (files: File[], origin: EditorFileOrigin) => void;
  /** Invoked by the in-editor save shortcut (Cmd/Ctrl+Enter). */
  onSubmit: () => void;
  isFocusMode?: boolean;
  /** Rich text, or the whole memo as Markdown text. Switching changes no text. */
  mode?: EditorMode;
  /** The draft's attachments, so images of managed attachments show. */
  attachments?: readonly Attachment[];
}

const EDITOR_ATTRIBUTES = {
  // Memos is a prose editor: keep the browser's text assistance on. Autocorrect
  // also keeps Windows TSF input out of Chrome's autocorrect-suppression path,
  // which has dropped committed text from the emoji picker.
  autocorrect: "on",
  autocapitalize: "on",
  spellcheck: "true",
};

/** The composer's editor: MemoMarkdown, editable, with the composer's extensions, behind the EditorController contract. */
const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorController>) {
  const { className, value, placeholder, onContentChange, onFiles, onSubmit, isFocusMode, mode, attachments } = props;
  const t = useTranslate();
  const editorRef = useRef<MarkdownEditorInstance | null>(null);
  // The extensions read the latest callbacks through refs, written after commit so
  // a render React discards never leaves its callbacks behind.
  const onContentChangeRef = useRef(onContentChange);
  const onFilesRef = useRef(onFiles);
  useLayoutEffect(() => {
    onContentChangeRef.current = onContentChange;
    onFilesRef.current = onFiles;
  });
  // A user can only author their own memos. Reuse the current-user stats query
  // instead of fetching and aggregating every user's tags for autocomplete.
  const { data: tagData } = useTagCounts(true);
  const tagsRef = useRef<string[]>([]);
  tagsRef.current = useMemo(() => Object.keys(tagData ?? {}), [tagData]);

  const controller = useMemo(
    () =>
      createController(
        () => editorRef.current,
        (markdown) => onContentChangeRef.current(markdown),
      ),
    [],
  );
  useImperativeHandle(ref, () => controller, [controller]);

  // Created once: the editor keeps its extensions for its lifetime, so the
  // callbacks read the latest props through refs.
  const extensions = useMemo(
    () =>
      buildEditorExtensions({
        getTags: () => tagsRef.current,
        onFiles: (files, origin) => onFilesRef.current(files, origin),
        // Read once, like the rest: the popup keeps the language the composer opened in.
        emojiLabel: t("editor.blocks.emoji"),
      }),
    [],
  );

  return (
    <div
      className={cn("relative flex w-full flex-col items-start justify-start bg-inherit", isFocusMode && "min-h-0 flex-1", className)}
      data-focus-mode={isFocusMode || undefined}
      data-source-mode={mode === "source" || undefined}
    >
      <div className={cn("memo-editor-scroller w-full text-base", isFocusMode && "min-h-0 flex-1")}>
        <MemoMarkdown
          editorRef={editorRef}
          value={value}
          editable
          onChange={onContentChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          mode={mode}
          attachments={attachments}
          extensions={extensions}
          attributes={EDITOR_ATTRIBUTES}
          theme={isFocusMode ? MEMO_FOCUS_EDITOR_THEME : undefined}
          className="memo-editor-root"
        />
      </div>
    </div>
  );
});

export default Editor;
