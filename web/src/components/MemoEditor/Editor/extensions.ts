import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { Compartment, type Extension } from "@codemirror/state";
import {
  placeholder as cmPlaceholder,
  dropCursor,
  EditorView,
  type KeyBinding,
  keymap,
} from "@codemirror/view";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";
import type { EditorCommandId } from "../formatting/commands";
import { runFormattingCommand } from "./formatting";
import { headingDecorations } from "./headingDecorations";
import {
  leadingWhitespace,
  liftListItem,
  selectedLineNumbers,
  sinkListItem,
} from "./listIndent";
import { tagAutocomplete } from "./tagAutocomplete";
import { tagMentionDecorations } from "./tagMentionDecorations";
import { memoEditorTheme } from "./theme";
import { uploadAnchorField } from "./uploadAnchors";

// Key bindings layered below the autocomplete keymap so the completion popup's
// own Tab/Escape win while it is open. On a list item, Tab/Shift-Tab nest /
// outdent it (marker-aware, CommonMark-valid); elsewhere they fall through to
// indentWithTab's plain indent. Escape blurs the editor so keyboard users keep
// an escape hatch out of the otherwise Tab-trapping editor.
const editorKeys: KeyBinding[] = [
  {
    key: "Escape",
    run: (view) => {
      view.contentDOM.blur();
      return true;
    },
  },
  { key: "Tab", run: sinkListItem },
  { key: "Shift-Tab", run: liftListItem },
];

const runFormat = (command: EditorCommandId) => (view: EditorView) => {
  runFormattingCommand(view, command);
  return true;
};

function toggleBlockquote(view: EditorView): boolean {
  const { state } = view;
  const lines = selectedLineNumbers(view).map((number) =>
    state.doc.line(number),
  );
  const nonBlank = lines.filter((line) => line.text.trim() !== "");
  const targets =
    lines.length === 1 || nonBlank.length === 0 ? lines : nonBlank;
  const quoted = targets.map((line) => {
    const indent = leadingWhitespace(line.text);
    return line.text.slice(indent).startsWith("> ");
  });
  const allQuoted = quoted.every(Boolean);
  const changes = targets.map((line) => {
    const indent = leadingWhitespace(line.text);
    return allQuoted
      ? { from: line.from + indent, to: line.from + indent + 2, insert: "" }
      : { from: line.from + indent, to: line.from + indent, insert: "> " };
  });
  if (changes.length === 0) return true;
  const changeSet = state.changes(changes);
  view.dispatch({
    changes: changeSet,
    selection: state.selection.map(changeSet, 1),
  });
  return true;
}

export interface EditorExtensionsOptions {
  placeholder: string;
  onChange: (markdown: string) => void;
  onFiles: (files: File[], position: number) => void;
  onUpdate: () => void;
  onSubmit: () => void;
  getTags: () => string[];
}

export const placeholderCompartment = new Compartment();

function clipboardFiles(event: ClipboardEvent): File[] {
  const clipboard = event.clipboardData;
  if (!clipboard) return [];

  const itemFiles = Array.from(clipboard.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return itemFiles.length > 0 ? itemFiles : Array.from(clipboard.files);
}

export function buildEditorExtensions({
  placeholder,
  onChange,
  onFiles,
  onUpdate,
  onSubmit,
  getTags,
}: EditorExtensionsOptions): Extension[] {
  // Submitting must outrank defaultKeymap's own Mod-Enter (insertBlankLine): the save
  // shortcut ends the memo, it must not also edit the document. Meta and Ctrl are bound
  // explicitly (not via the platform-dependent Mod-) so Cmd+Enter and Ctrl+Enter both
  // submit everywhere, matching the historical window-level shortcut.
  const submit = () => {
    onSubmit();
    return true;
  };
  // Helper to generate both Meta and Ctrl variants for a key binding.
  const mod = (key: string, run: KeyBinding["run"]): KeyBinding[] => [
    { key: `Meta-${key}`, run },
    { key: `Ctrl-${key}`, run },
  ];
  const submitKeys: KeyBinding[] = mod("Enter", submit);
  const formattingKeys: KeyBinding[] = [
    ...mod("b", runFormat("bold")),
    ...mod("i", runFormat("italic")),
    ...mod("Shift-x", runFormat("strikethrough")),
    ...mod("e", runFormat("code")),
    ...mod("j", runFormat("link")), // override since cmd/ctrl k is taken
    ...mod("Alt-1", runFormat("heading1")),
    ...mod("Alt-2", runFormat("heading2")),
    ...mod("Alt-3", runFormat("heading3")),
    // Asymmetric: on macOS the list marker `-` is shifted-7; on Windows/Linux it's
    // shifted-8 because `/` (unshifted-7) is already on the 8 key in the US layout.
    { key: "Meta-Shift-7", run: runFormat("bulletList") },
    { key: "Ctrl-Shift-8", run: runFormat("bulletList") },
    ...mod("Shift-9", toggleBlockquote),
  ];

  return [
    // Core editing behavior. These are the pieces from CM6 setup that this memo
    // editor uses, without enabling multi-cursor selection.
    history(),
    dropCursor(),
    // Indent with spaces (markdown), matching the 2-space bullet nesting.
    indentUnit.of("  "),
    markdown({ extensions: memoMarkdownExtensions }),
    ...memoEditorTheme,
    EditorView.lineWrapping,
    // CodeMirror disables native text assistance because it is primarily a code
    // editor. Memos is a prose editor, so restore the browser behavior used by
    // the textarea editor before v0.30. Autocorrect also keeps Windows TSF input
    // out of Chrome's autocorrect-suppression path, which has dropped committed
    // text from the emoji picker.
    EditorView.contentAttributes.of({
      autocorrect: "on",
      autocapitalize: "on",
      spellcheck: "true",
    }),
    placeholderCompartment.of(cmPlaceholder(placeholder)),
    EditorView.domEventHandlers({
      paste: (event, view) => {
        const files = clipboardFiles(event);
        if (files.length === 0) return false;
        onFiles(files, view.state.selection.main.head);
        return true;
      },
      drop: (event, view) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        const position =
          view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
          view.state.selection.main.head;
        onFiles(files, position);
        return true;
      },
    }),
    tagMentionDecorations,
    headingDecorations,
    uploadAnchorField,
    // tagAutocomplete must precede the editing keymap so the completion popup's
    // Enter/Tab/arrow bindings win while it is open.
    tagAutocomplete(getTags),
    keymap.of([
      ...submitKeys,
      ...formattingKeys,
      ...editorKeys,
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state.doc.toString());
      // Toolbar active-state depends only on the doc and selection; skip the
      // getActiveFormats tree walk on focus/viewport/measure-only updates.
      if (u.docChanged || u.selectionSet) onUpdate();
    }),
  ];
}
