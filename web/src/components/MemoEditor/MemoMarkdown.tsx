import type { Editor, EditorMode, Extension } from "@usememos/editor";
import { MarkdownEditor, type MarkdownEditorProps } from "@usememos/editor/react";
import "@usememos/editor/style.css";
import { type Ref, useCallback, useMemo, useState } from "react";
import { MEMO_EDITOR_THEME, MEMO_MARKDOWN, memoEditorLabels, memoExtensions, memoResolveUrl } from "@/lib/memo-markdown";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useMemoDecorations } from "./useMemoDecorations";

export interface MemoMarkdownProps {
  /** The Markdown. Applied only when it is not a value the editor emitted itself. */
  value: string;
  /** Editing, or the read-only memo view. Default read-only. Updates live. */
  editable?: boolean;
  /** While read-only, lets the viewer tick task items; each tick reports the new Markdown through `onChange`. */
  taskToggle?: boolean;
  onChange?: (markdown: string) => void;
  /** Mod+Enter or Ctrl+Enter while editing. */
  onSubmit?: () => void;
  /** Rich text, or the whole memo as Markdown text. Switching changes no text. */
  mode?: EditorMode;
  placeholder?: string;
  /** The memo's attachments, so images of managed attachments resolve to their served URL. */
  attachments?: readonly Attachment[];
  /** Extensions beyond the memo syntax, for editing. Keep the array's identity stable: a new set of names recreates the editor. */
  extensions?: readonly Extension[];
  /** The core editor instance. */
  editorRef?: Ref<Editor | null>;
  headingIds?: MarkdownEditorProps["headingIds"];
  onLinkClick?: MarkdownEditorProps["onLinkClick"];
  /** A tag was clicked to be followed (a plain click while read-only, Mod+click while editing), without its `#`. */
  onTagClick?: (tag: string) => void;
  /** A mention of someone who exists was clicked to be followed, without its `@`. */
  onMentionClick?: (username: string) => void;
  /** Attributes for the editable root, such as `spellcheck`. */
  attributes?: Record<string, string>;
  /** The formatting toolbar and the image toolbar. Read once; the editor hides them while read-only. */
  toolbar?: boolean;
  /** The slash menu's items, or `false` for none. Read once. */
  slashMenu?: MarkdownEditorProps["slashMenu"];
  className?: string;
}

const assignRef = <T,>(ref: Ref<T> | undefined, value: T) => {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
};

/**
 * A memo's Markdown in memos' dialect, look and policy, shown by the same editor whether
 * read-only or editing: the memo syntax extensions (math, footnotes, tags, mentions,
 * highlighted code, Mermaid, sanitized HTML), the theme in the app's CSS variables, the
 * translated labels, the image and link URL policy, and tags and mentions decorated from
 * the viewer's data. Everything a memo surface adds sits around this component.
 */
export const MemoMarkdown = (props: MemoMarkdownProps) => {
  const {
    value,
    editable = false,
    taskToggle,
    onChange,
    onSubmit,
    mode,
    placeholder,
    attachments,
    extensions,
    editorRef,
    headingIds,
    onLinkClick,
    onTagClick,
    onMentionClick,
    attributes,
    toolbar,
    slashMenu,
    className,
  } = props;
  const t = useTranslate();
  const [editor, setEditor] = useState<Editor | null>(null);
  const attach = useCallback(
    (instance: Editor | null) => {
      setEditor(instance);
      assignRef(editorRef, instance);
    },
    [editorRef],
  );

  const decorations = useMemoDecorations(editor, value, editable, { onTagClick, onMentionClick });
  const baseExtensions = useMemo(() => memoExtensions({ tags: decorations.tags, mentions: decorations.mentions }), [decorations]);
  const allExtensions = useMemo(
    () => (extensions?.length ? [...baseExtensions, ...extensions] : baseExtensions),
    [baseExtensions, extensions],
  );
  const labels = useMemo(() => memoEditorLabels(t), [t]);
  const resolveUrl = useMemo(() => memoResolveUrl(attachments), [attachments]);
  return (
    <MarkdownEditor
      ref={attach}
      value={value}
      // The React wrapper calls the latest callbacks, so inline functions are fine.
      onChange={onChange}
      onSubmit={onSubmit ? () => onSubmit() : undefined}
      editable={editable}
      taskToggle={taskToggle}
      mode={mode}
      placeholder={placeholder}
      markdown={MEMO_MARKDOWN}
      extensions={allExtensions}
      theme={MEMO_EDITOR_THEME}
      labels={labels}
      attributes={attributes}
      resolveUrl={resolveUrl}
      referrerPolicy="no-referrer"
      headingIds={headingIds}
      onLinkClick={onLinkClick}
      toolbar={toolbar}
      slashMenu={slashMenu}
      className={className}
    />
  );
};
