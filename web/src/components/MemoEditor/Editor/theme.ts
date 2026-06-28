import { syntaxHighlighting } from "@codemirror/language";
import { tags as t, tagHighlighter } from "@lezer/highlight";

/**
 * Map markdown syntax tokens to stable class names. ALL visual styling lives in
 * plain CSS (the `.memo-editor-content` block in `src/index.css`) so the editor
 * is themed like the rest of the app — Tailwind/theme tokens in a stylesheet —
 * rather than a CodeMirror CSS-in-JS theme object. Headings (`.cm-md-h*`) and
 * `#tag`/`@mention` (`.cm-memo-*`) classes come from the decoration plugins;
 * the rest of the `.cm-*` chrome is CodeMirror's own and is styled in that CSS.
 */
const markdownHighlighter = tagHighlighter([
  { tag: t.strong, class: "cm-md-strong" },
  { tag: t.emphasis, class: "cm-md-emphasis" },
  { tag: t.strikethrough, class: "cm-md-strike" },
  { tag: t.monospace, class: "cm-md-code" },
  { tag: t.link, class: "cm-md-link" },
  { tag: t.url, class: "cm-md-url" },
  { tag: t.quote, class: "cm-md-quote" },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], class: "cm-md-mark" },
]);

export const memoEditorTheme = [syntaxHighlighting(markdownHighlighter)];
