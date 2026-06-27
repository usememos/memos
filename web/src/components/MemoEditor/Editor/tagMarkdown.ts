import type { JSONContent } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import type { Schema } from "@tiptap/pm/model";
import { TAG_RUN } from "@/utils/tag-grammar";

// A `#` begins a memo tag when a capped TAG_RUN follows it — the same grammar
// the editor tokenizer (Tag.ts) matches, so escape and parse can't disagree.
// The lookahead matches only the `#`, leaving the run itself untouched.
const TAG_HASH = new RegExp(`#(?=${TAG_RUN})`, "gu");

/**
 * Backslash-escape a `#` that would otherwise re-parse into a `#tag`.
 *
 * memos layers hashtag syntax on top of CommonMark, so — exactly as
 * prosemirror-markdown escapes inline syntax characters like `*` and `_` —
 * plain text that looks like a tag must be escaped on serialize, or it silently
 * becomes a tag on the next parse.
 */
export function escapeTagHashes(text: string): string {
  return text.replace(TAG_HASH, "\\#");
}

type JsonMark = string | { type?: string };
type JsonNode = { type?: string; marks?: JsonMark[] };
type PatchableManager = {
  encodeTextForMarkdown?: (text: string, node: JsonNode, parentNode?: JsonNode) => string;
  parse?: (markdown: string) => JSONContent;
};

const markName = (mark: JsonMark): string => (typeof mark === "string" ? mark : (mark.type ?? ""));
const hasMark = (node: JsonNode, name: string): boolean => (node.marks ?? []).some((mark) => markName(mark) === name);

/**
 * A `#tag` only forms in plain inline prose. The tokenizer declines inside
 * links, and `code: true` marks/nodes (the Tag mark itself, inline code,
 * preserved spans/blocks, code blocks) serialize verbatim — so escaping a `#`
 * in any of those contexts would be wrong (and would corrupt the byte-identical
 * round-trips those constructs rely on).
 */
function escapesTagsHere(schema: Schema, node: JsonNode, parentNode?: JsonNode): boolean {
  for (const mark of node.marks ?? []) {
    const name = markName(mark);
    if (name === "link") {
      return false;
    }
    if (schema.marks[name]?.spec.code) {
      return false;
    }
  }
  const parentType = parentNode?.type;
  if (parentType && schema.nodes[parentType]?.spec.code) {
    return false;
  }
  return true;
}

/**
 * Strip the `tag` mark from any text that also carries a `link` mark.
 *
 * The `markdownTokenizer` in Tag.ts cannot tell it is inside a link label — the
 * manager forwards only `{ inlineTokens, blockTokens }`, never the lexer's
 * `inLink` state — so `[see #x](url)` parses with `#x` tagged. We undo that as a
 * tree pass, the same way the read-only renderer (remark-tag) skips link nodes,
 * keeping the editor and renderer in agreement: a `#` in a link label is link
 * text, never a tag pill.
 */
function stripTagInsideLinks(node: JSONContent): JSONContent {
  if (Array.isArray(node.marks) && hasMark(node, "link")) {
    node.marks = node.marks.filter((mark) => markName(mark) !== "tag");
  }
  node.content?.forEach(stripTagInsideLinks);
  return node;
}

/**
 * The `markdownTokenizer` in Tag.ts handles `#tag` the canonical
 * @tiptap/markdown way, but two memos-specific concerns sit above the tokenizer
 * and have no public hook, so we compose them onto the manager here:
 *
 *  - serialize: escape a tag-shaped `#` in plain prose ({@link escapeTagHashes})
 *    so a literal `#NAS` can't silently re-parse into a tag;
 *  - parse: skip tags inside link labels ({@link stripTagInsideLinks}).
 *
 * Escapes stay a purely lexical concern — the document model carries no
 * "escaped tag" node or mark. A literal `#NAS` is just text: parsing strips a
 * leading `\` (marked's built-in escape) and serializing adds it back, the same
 * way TipTap handles every other escapable character.
 */
export const TagAwareMarkdown = Markdown.extend({
  onBeforeCreate(props) {
    this.parent?.(props);
    const { editor } = this;
    const manager = editor.markdown as unknown as PatchableManager | undefined;
    if (!manager) {
      return;
    }

    const encode = manager.encodeTextForMarkdown;
    if (typeof encode === "function") {
      const bound = encode.bind(manager);
      manager.encodeTextForMarkdown = (text, node, parentNode) => {
        const encoded = bound(text, node, parentNode);
        return escapesTagsHere(editor.schema, node, parentNode) ? escapeTagHashes(encoded) : encoded;
      };
    }

    const parse = manager.parse;
    if (typeof parse === "function") {
      const bound = parse.bind(manager);
      manager.parse = (markdown) => stripTagInsideLinks(bound(markdown));
    }
  },
});
