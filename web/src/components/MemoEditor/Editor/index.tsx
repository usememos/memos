import { Extension } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { AllSelection, Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import type { EditorProps as ProseMirrorEditorProps } from "@tiptap/pm/view";
import { EditorContent as RichTextContent, useEditor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { matchPath } from "react-router-dom";
import { useTagCounts } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { ROUTES as Routes } from "@/router/routes";
import { EDITOR_HEIGHT } from "../constants";
import type { EditorController } from "../types/editorController";
import { EDITOR_COMMANDS_BY_ID, EMPTY_ACTIVE_FORMATS, getActiveFormats } from "./editorCommands";
import { buildExtensions } from "./extensions";
import { createTagSuggestion } from "./TagSuggestion";

// Mod-Enter is the app-wide "save memo" shortcut (useKeyboard). StarterKit's
// HardBreak extension also binds Mod-Enter to insert a hard break, which would
// mutate the document right before save fires. This extension swallows the
// shortcut (returning true stops further keymap handlers) while preserving
// DOM event bubbling — preventDefault does NOT stopPropagation, so the window-
// level save listener in useKeyboard still receives and handles the keystroke.
// Priority 1000 > HardBreak's default 100, so this handler runs first.
// Shift-Enter still inserts a hard break as expected.
const SaveShortcutPassthrough = Extension.create({
  name: "saveShortcutPassthrough",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => true,
    };
  },
});

// Ctrl+A makes ProseMirror's whole-document AllSelection. Deleting it
// (Backspace / Delete / Cut) empties the document, but AllSelection.map()
// always returns another AllSelection — so the editor is left holding a
// non-empty selection spanning the now-empty paragraph, which the view paints
// as a "selected" empty block (the reported artifact). After any doc-changing
// edit that leaves an AllSelection behind, collapse it to a caret at the start,
// the same way deleting an ordinary text selection collapses to a cursor.
// The `instanceof AllSelection` guard re-evaluates against the post-collapse
// state, so the appended selection-only transaction is not re-processed.
const CollapseAllSelectionAfterDelete = Extension.create({
  name: "collapseAllSelectionAfterDelete",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("collapseAllSelectionAfterDelete"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged) || !(newState.selection instanceof AllSelection)) {
            return null;
          }
          return newState.tr.setSelection(Selection.atStart(newState.doc));
        },
      }),
    ];
  },
});

export interface EditorProps {
  className?: string;
  initialContent: string;
  placeholder: string;
  isFocusMode?: boolean;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
}

/**
 * The Document serializer joins/terminates blocks with `\n\n`, so e.g. a task
 * list serializes with a trailing blank line. Outer whitespace is meaningless
 * at the document level (the round-trip corpus compares modulo outer trim),
 * so every markdown string leaving this component is trimmed.
 */
function serializeMarkdown(editor: { getMarkdown: () => string } | null): string {
  return (editor?.getMarkdown() ?? "").trim();
}

/**
 * WYSIWYG memo editor built on ProseMirror. Markdown is the only format
 * crossing its boundary: in via setContent(contentType: "markdown"), out via
 * serializeMarkdown() on every update. IME, list continuation, input rules,
 * and auto-grow are native ProseMirror/contenteditable behavior.
 */
const Editor = forwardRef<EditorController, EditorProps>(function Editor(props, ref) {
  const { className, initialContent, placeholder, isFocusMode, onContentChange, onPaste } = props;

  // Last markdown emitted through onContentChange, so the sync effect can
  // recognize the parent echoing our own value back without re-serializing.
  const lastEmittedRef = useRef<string | null>(null);
  // Stable across editor re-creation so the toolbar can subscribe once. The
  // effect below binds the live editor's transaction/selection events to it.
  const activeListenersRef = useRef(new Set<() => void>());
  // Read through refs so the memoized extension/editorProps closures below
  // always see the latest props (Placeholder decorations recompute per
  // transaction; handlePaste resolves per event).
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;
  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  // On the explore page suggestions include all users' tags; otherwise the
  // current user's.
  const isExplorePage = useMemo(() => Boolean(matchPath(Routes.EXPLORE, window.location.pathname)), []);
  const { data: tagCount = {} } = useTagCounts(!isExplorePage);
  const sortedTags = useMemo(
    () =>
      Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag]) => tag),
    [tagCount],
  );
  const tagsRef = useRef<string[]>([]);
  tagsRef.current = sortedTags;

  // Stable option identities so useEditor's compareOptions stays equal across
  // renders and the editor skips a needless setOptions/view.setProps pass per
  // keystroke. All dynamic values reach the closures through refs above.
  // `content` is only consumed at editor creation — later external changes
  // flow through the sync effect — so the mount-time value is frozen too.
  const mountContentRef = useRef(initialContent);
  const extensions = useMemo(
    () => [
      ...buildExtensions(),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
      createTagSuggestion({ getTags: () => tagsRef.current }),
      SaveShortcutPassthrough,
      CollapseAllSelectionAfterDelete,
    ],
    [],
  );
  const editorProps = useMemo<ProseMirrorEditorProps>(
    () => ({
      attributes: {
        class: "memo-wysiwyg outline-none w-full text-base break-words min-h-6",
      },
      handlePaste: (_view, event) => {
        const hasFiles = Array.from(event.clipboardData?.items ?? []).some((item) => item.kind === "file");
        if (hasFiles) {
          onPasteRef.current(event as unknown as React.ClipboardEvent);
          return true;
        }
        // Text paste (incl. URL-over-selection → link) is handled natively.
        return false;
      },
    }),
    [],
  );

  const editor = useEditor({
    extensions,
    content: mountContentRef.current,
    contentType: "markdown",
    editorProps,
    onUpdate: ({ editor: currentEditor }) => {
      const markdown = serializeMarkdown(currentEditor);
      lastEmittedRef.current = markdown;
      onContentChange(markdown);
    },
  });

  // Sync external content changes (e.g. reset after save, draft restore)
  // without clobbering the document the user is typing into: only apply when
  // the markdown actually differs.
  useEffect(() => {
    if (!editor) {
      return;
    }
    // Parent echo of our own emission — nothing to sync (O(1) fast path).
    // Comparing against the live document instead would race: a keystroke
    // landing between the emission and this passive effect would make the
    // echo look like an external change and clobber the keystroke/cursor.
    if (initialContent === lastEmittedRef.current) {
      return;
    }
    // Never clobber an in-progress IME composition.
    if (editor.view.composing) {
      return;
    }
    if (serializeMarkdown(editor) !== initialContent.trim()) {
      editor.commands.setContent(initialContent, { contentType: "markdown", emitUpdate: false });
      // A subsequent identical echo of this value is also a no-op.
      lastEmittedRef.current = initialContent;
    }
  }, [initialContent, editor]);

  // Fan editor transactions out to toolbar subscribers so active-state
  // highlighting tracks the cursor live. Every change — including a pure
  // selection move — is a transaction, so this single event covers both.
  useEffect(() => {
    if (!editor) {
      return;
    }
    const notify = () => activeListenersRef.current.forEach((listener) => listener());
    editor.on("transaction", notify);
    return () => {
      editor.off("transaction", notify);
    };
  }, [editor]);

  useImperativeHandle(
    ref,
    (): EditorController => ({
      focus: () => editor?.commands.focus(),
      hasFocus: () => editor?.isFocused ?? false,
      // Contract: whitespace-only counts as empty. The editor's structural
      // `editor.isEmpty` would call a paragraph of spaces non-empty.
      isEmpty: () => serializeMarkdown(editor) === "",
      getMarkdown: () => serializeMarkdown(editor),
      setMarkdown: (markdown) => editor?.commands.setContent(markdown, { contentType: "markdown" }),
      insertMarkdown: (markdown) => editor?.chain().focus().insertContent(markdown, { contentType: "markdown" }).run(),
      scrollToCursor: () => editor?.commands.scrollIntoView(),
      selectAll: () => editor?.commands.selectAll(),
      // WYSIWYG supports rich formatting; the whole surface is driven by the
      // shared command catalog (editorCommands.ts), so adding a verb there
      // flows here — and to the toolbar and active-state — with no edit here.
      formatting: {
        run: (command, ctx) => {
          if (editor) {
            EDITOR_COMMANDS_BY_ID[command]?.run(editor, ctx);
          }
        },
        getActiveFormats: () => (editor ? getActiveFormats(editor) : EMPTY_ACTIVE_FORMATS),
        getSelectedText: () => {
          if (!editor) {
            return "";
          }
          const { from, to } = editor.state.selection;
          return editor.state.doc.textBetween(from, to, " ");
        },
        subscribe: (listener) => {
          activeListenersRef.current.add(listener);
          return () => {
            activeListenersRef.current.delete(listener);
          };
        },
      },
    }),
    [editor],
  );

  return (
    <div
      className={cn(
        "flex flex-col justify-start items-start relative w-full bg-inherit overflow-y-auto overflow-x-hidden",
        isFocusMode ? "flex-1" : `h-auto ${EDITOR_HEIGHT.normal}`,
        className,
      )}
      onClick={(event) => {
        // In focus mode the wrapper extends below the content; a click on the
        // empty area should land the caret at the end instead of doing nothing.
        if (event.target === event.currentTarget) {
          editor?.commands.focus("end");
        }
      }}
    >
      <RichTextContent editor={editor} className="w-full" />
    </div>
  );
});

export default Editor;
