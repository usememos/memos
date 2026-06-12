import { Editor, type JSONContent } from "@tiptap/core";
import { buildExtensions } from "./extensions";

/**
 * Headless markdown ⇄ ProseMirror document helpers built on the exact same
 * extension list as the live editor. Used by the round-trip corpus tests and
 * the memo-open load guard.
 *
 * WHY A SINGLETON:
 * `@tiptap/markdown`'s MarkdownManager registers each extension's
 * `markdownTokenizer` onto the global `marked` singleton via `marked.use(...)`
 * inside every `new Editor(...)` construction, and `editor.destroy()` never
 * unregisters those tokenizers. `@tiptap/extension-list` ships 2 block
 * tokenizers, so every per-call editor construction leaks 2 registrations onto
 * the global marked instance. The resulting accumulation causes parse time to
 * degrade measurably (observed: ~0.7 s → 14.5 s over ~120 calls). The
 * preserved-syntax bridges (PreservedBlock.ts) add more custom tokenizers per
 * Editor construction — each live editor mount registers them globally too —
 * so the codec singleton keeps the tests/load-guard pinned at one registration.
 *
 * WHY NOT `Markdown.configure({ marked: new Marked() })`:
 * Upstream `MarkdownManager.createLexer()` calls
 * `new this.markedInstance.Lexer()` without passing the options object that
 * carries the instance-registered tokenizer extensions, so any tokenizers
 * registered on the private Marked instance are silently ignored.  Task-list
 * syntax breaks: `- [ ] open` round-trips to `- open`.
 *
 * The singleton is created lazily on first use and reused forever.
 */
let _singletonEditor: Editor | null = null;

function getSingletonEditor(): Editor {
  if (!_singletonEditor) {
    _singletonEditor = new Editor({
      extensions: buildExtensions(),
      content: "",
      contentType: "markdown",
    });
  }
  return _singletonEditor;
}

function getMarkdownManager() {
  const editor = getSingletonEditor();
  if (!editor.markdown) {
    throw new Error("markdownCodec: editor.markdown is not available — ensure @tiptap/markdown is in the extension list");
  }
  return editor.markdown;
}

export function parseMarkdown(markdown: string): JSONContent {
  return getMarkdownManager().parse(markdown);
}

export function roundTripMarkdown(markdown: string): string {
  const manager = getMarkdownManager();
  return manager.serialize(manager.parse(markdown));
}

/** True when a serialize cycle would not change the document's meaning. */
export function isLosslessRoundTrip(markdown: string): boolean {
  try {
    const manager = getMarkdownManager();
    const once = manager.parse(markdown);
    const twice = manager.parse(manager.serialize(once));
    return JSON.stringify(once) === JSON.stringify(twice);
  } catch {
    return false;
  }
}
