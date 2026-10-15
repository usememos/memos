import type { Editor as MarkdownEditorInstance } from "@usememos/editor";
import { MarkdownEditor } from "@usememos/editor/react";
import "@usememos/editor/style.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useDebouncedEffect } from "@/hooks";
import { useTagCounts, useUsersByUsernames } from "@/hooks/useUserQueries";
import { extractMentionUsernames, MEMO_EDITOR_THEME, MEMO_MARKDOWN, memoEditorLabels, memoResolveUrl } from "@/lib/memo-markdown";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { UserSetting_TagsSetting } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import type { EditorController } from "../types/editorController";
import { createController } from "./controller";
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
  /** The draft's attachments, so images of managed attachments show. */
  attachments?: readonly Attachment[];
  /** The user's tag settings, for tags in their custom colors. */
  tagsSetting?: UserSetting_TagsSetting;
}

const EDITOR_ATTRIBUTES = {
  // Memos is a prose editor: keep the browser's text assistance on. Autocorrect
  // also keeps Windows TSF input out of Chrome's autocorrect-suppression path,
  // which has dropped committed text from the emoji picker.
  autocorrect: "on",
  autocapitalize: "on",
  spellcheck: "true",
};

const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorController>) {
  const { className, value, placeholder, onContentChange, onFiles, onSubmit, isFocusMode, attachments, tagsSetting } = props;
  const t = useTranslate();
  const editorRef = useRef<MarkdownEditorInstance | null>(null);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  // A user can only author their own memos. Reuse the current-user stats query
  // instead of fetching and aggregating every user's tags for autocomplete.
  const { data: tagData } = useTagCounts(true);
  const tagsRef = useRef<string[]>([]);
  tagsRef.current = useMemo(() => Object.keys(tagData ?? {}), [tagData]);

  const tagsSettingRef = useRef(tagsSetting);
  tagsSettingRef.current = tagsSetting;
  // Tag colors are drawn from the settings; draw them again when the settings change.
  const decoratedTagsSetting = useRef(tagsSetting);
  useEffect(() => {
    if (decoratedTagsSetting.current === tagsSetting) return;
    decoratedTagsSetting.current = tagsSetting;
    editorRef.current?.redecorate();
  }, [tagsSetting]);

  // Mentions of people who exist are drawn as in the memo view. The names are looked up
  // once typing pauses, so a half-typed name is not; until a lookup answers, the people
  // already found stay found.
  const [mentionNames, setMentionNames] = useState<string[]>([]);
  useDebouncedEffect(
    () => {
      const next = extractMentionUsernames(value);
      setMentionNames((previous) => (previous.join("\n") === next.join("\n") ? previous : next));
    },
    400,
    [value],
  );
  const { data: mentionUsers } = useUsersByUsernames(mentionNames);
  const resolvedMentionsRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!mentionUsers) return;
    const next = new Set([...mentionUsers].flatMap(([username, user]) => (user ? [username] : [])));
    const current = resolvedMentionsRef.current;
    if (next.size === current.size && [...next].every((username) => current.has(username))) return;
    resolvedMentionsRef.current = next;
    editorRef.current?.redecorate();
  }, [mentionUsers]);

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
        getTagsSetting: () => tagsSettingRef.current,
        isMentionResolved: (username) => resolvedMentionsRef.current.has(username),
        // Read once, like the rest: the popup keeps the language the composer opened in.
        emojiLabel: t("editor.blocks.emoji"),
      }),
    [],
  );
  const labels = useMemo(() => memoEditorLabels(t), [t]);
  const resolveUrl = useMemo(() => memoResolveUrl(attachments), [attachments]);

  return (
    <div
      className={cn("relative flex w-full flex-col items-start justify-start bg-inherit", isFocusMode && "min-h-0 flex-1", className)}
      data-focus-mode={isFocusMode || undefined}
    >
      <div className={cn("memo-editor-scroller w-full text-base", isFocusMode && "min-h-0 flex-1")}>
        <MarkdownEditor
          ref={editorRef}
          value={value}
          onChange={onContentChange}
          onSubmit={() => onSubmitRef.current()}
          placeholder={placeholder}
          markdown={MEMO_MARKDOWN}
          extensions={extensions}
          theme={MEMO_EDITOR_THEME}
          labels={labels}
          attributes={EDITOR_ATTRIBUTES}
          resolveUrl={resolveUrl}
          referrerPolicy="no-referrer"
          className="memo-editor-root"
        />
      </div>
    </div>
  );
});

export default Editor;
