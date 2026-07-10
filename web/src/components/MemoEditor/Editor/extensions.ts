import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { placeholder as cmPlaceholder, drawSelection, dropCursor, EditorView, type KeyBinding, keymap } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { headingDecorations } from "./headingDecorations";
import { liftListItem, sinkListItem } from "./listIndent";
import { tagAutocomplete } from "./tagAutocomplete";
import { tagMentionDecorations } from "./tagMentionDecorations";
import { memoEditorTheme } from "./theme";

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

export interface EditorExtensionsOptions {
  placeholder: string;
  onChange: (markdown: string) => void;
  onUpdate: () => void;
  onSubmit: () => void;
  getTags: () => string[];
}

export function buildEditorExtensions({ placeholder, onChange, onUpdate, onSubmit, getTags }: EditorExtensionsOptions): Extension[] {
  // Submitting must outrank defaultKeymap's own Mod-Enter (insertBlankLine): the save
  // shortcut ends the memo, it must not also edit the document. Meta and Ctrl are bound
  // explicitly (not via the platform-dependent Mod-) so Cmd+Enter and Ctrl+Enter both
  // submit everywhere, matching the historical window-level shortcut.
  const submit = () => {
    onSubmit();
    return true;
  };
  const submitKeys: KeyBinding[] = [
    { key: "Meta-Enter", run: submit },
    { key: "Ctrl-Enter", run: submit },
  ];

  return [
    // Core editing behavior. These are the pieces from CM6 setup that this memo
    // editor uses, without enabling multi-cursor selection.
    history(),
    drawSelection(),
    dropCursor(),
    // Indent with spaces (markdown), matching the 2-space bullet nesting.
    indentUnit.of("  "),
    markdown({ extensions: [GFM] }),
    ...memoEditorTheme,
    EditorView.lineWrapping,
    cmPlaceholder(placeholder),
    tagMentionDecorations,
    headingDecorations,
    // tagAutocomplete must precede the editing keymap so the completion popup's
    // Enter/Tab/arrow bindings win while it is open.
    tagAutocomplete(getTags),
    keymap.of([...submitKeys, ...editorKeys, indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state.doc.toString());
      // Toolbar active-state depends only on the doc and selection; skip the
      // getActiveFormats tree walk on focus/viewport/measure-only updates.
      if (u.docChanged || u.selectionSet) onUpdate();
    }),
  ];
}
