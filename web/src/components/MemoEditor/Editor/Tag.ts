import type { MarkdownToken } from "@tiptap/core";
import { InputRule, Mark, mergeAttributes } from "@tiptap/core";
import type { TokenizerThis, Tokens } from "marked";
import { marked } from "marked";
import { tagStyles } from "@/lib/markdownStyles";
import { MAX_TAG_LENGTH, TAG_CHAR_CLASS } from "@/utils/tag-grammar";

// Default tag pill, shared with the read-only view (MemoContent/Tag.tsx).
// Computed once — renderHTML runs on every view update.
const TAG_CLASS = `${tagStyles.base} ${tagStyles.defaultColor}`;

// Built from the shared tag grammar (@/utils/tag-grammar) so the editor's
// tokenizer/input rule can't drift from the read-only renderer's lexer
// (web/src/utils/remark-plugins/remark-tag.ts).
const TAG_INPUT_RULE = new RegExp(`(?:^|\\s)#(${TAG_CHAR_CLASS}{1,${MAX_TAG_LENGTH}})\\s$`, "u");
const TAG_TOKEN_RULE = new RegExp(`^#(${TAG_CHAR_CLASS}{1,${MAX_TAG_LENGTH}})`, "u");
// Tests the REMAINDER of the source (not a single code unit) so astral-plane
// tag characters (emoji et al.) are seen whole, not as lone surrogates.
const TAG_CHAR_AHEAD = new RegExp(`^${TAG_CHAR_CLASS}`, "u");

/**
 * Tag tokenizer, registered DIRECTLY on the global marked singleton instead of
 * through `markdownTokenizer`. Two reasons:
 *
 * 1. `@tiptap/markdown`'s MarkdownManager wraps `markdownTokenizer.tokenize`
 *    in `tokenizer(src, tokens) { ... tokenize(src, tokens, helper) }` — the
 *    wrapper receives marked's TokenizerThis (with `lexer.state.inLink`) but
 *    does NOT forward it, so a manager-registered tokenizer can never know it
 *    is inside a link label. Registered natively, marked invokes us with
 *    `this.lexer` bound and we can decline inside `[label](url)` the same way
 *    remark-tag skips link nodes.
 * 2. The manager defaults to the global `marked` export (`markedInstance =
 *    options?.marked ?? marked`) and `web` resolves the exact same marked
 *    module instance as `@tiptap/markdown` does, so this registration is
 *    visible to every lexer the manager creates. Module scope + idempotent:
 *    registered exactly once per page load (the manager's own per-Editor
 *    `marked.use` calls are the accumulation hazard documented in
 *    markdownCodec.ts; this adds a single registration, ever).
 *
 * The Tag mark below still declares `markdownTokenName: "memoTag"` +
 * `parseMarkdown`, which is all the manager needs to route the token.
 */
function tokenizeTag(this: TokenizerThis, src: string): Tokens.Generic | undefined {
  // remark-tag skips link nodes entirely; marked sets `state.inLink` while
  // tokenizing link/reflink labels, so declining here keeps `[see #x](url)`
  // a plain link label instead of tearing the tag out of it.
  if (this.lexer?.state?.inLink) {
    return undefined;
  }
  const match = TAG_TOKEN_RULE.exec(src);
  if (!match) {
    return undefined;
  }
  const rest = src.slice(match[0].length);
  // `#a#b`: decline when the run is directly followed by another `#`, so the
  // FIRST run stays plain text. NOT full remark parity — remark-tag treats
  // `#a#b` as two tags and `##x` as all-text, while here `#a#b` becomes text
  // "#a" + tag "b" and `##x` becomes text "#" + tag "x". The divergence is
  // visual-only in the editor: both shapes serialize back byte-identically
  // (the surrounding text nodes re-emit their literal characters).
  if (rest.startsWith("#")) {
    return undefined;
  }
  // Runs longer than 100 tag characters are not tags at all in remark-tag
  // (the whole run stays plain text) — decline instead of splitting the run
  // into a 100-char tag plus leftover text.
  if (TAG_CHAR_AHEAD.test(rest)) {
    return undefined;
  }
  return { type: "memoTag", raw: match[0], text: match[0], tag: match[1] };
}

let tagTokenizerRegistered = false;
function registerTagTokenizer() {
  if (tagTokenizerRegistered) {
    return;
  }
  tagTokenizerRegistered = true;
  marked.use({
    extensions: [
      {
        name: "memoTag",
        level: "inline",
        start: (src: string) => src.indexOf("#"),
        tokenizer: tokenizeTag,
      },
    ],
  });
}
registerTagTokenizer();

/**
 * Mark for memos `#tags`: styled in the editor, serialized back to `#tag`
 * verbatim. Modeled as a `code: true` text mark (the PreservedInline pattern,
 * see PreservedBlock.ts) rather than an inline atom node: text marks compose
 * through the serializer's mark open/close machinery, so a tag inside
 * `**bold**` or a heading round-trips byte-identically, and `code: true`
 * keeps the literal text (`#a_b`) unescaped. Inline atoms cannot do either —
 * `applyMarkToContent` only attaches enclosing marks to text nodes, so an
 * atom inside bold silently drops the bold delimiters.
 *
 * Parsed live while typing (input rule) and from markdown (the native marked
 * tokenizer above).
 */
export const Tag = Mark.create({
  name: "tag",
  // Typing immediately after a tag must not extend it.
  inclusive: false,
  // Serializer emits the inner text verbatim, without escaping.
  code: true,

  addAttributes() {
    return {
      // The tag name without `#`, for downstream consumers (e.g. suggestion
      // insertion). Stored as `tag` but rendered/parsed as `data-tag`.
      tag: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-tag") ?? "",
        renderHTML: (attributes) => ({ "data-tag": attributes.tag }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-tag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: TAG_CLASS,
      }),
      0,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: TAG_INPUT_RULE,
        handler: ({ state, range, match }) => {
          // The match may include a leading separator — only mark from the
          // `#`. The trailing space stays outside the mark; because the
          // handler produces steps the typed space is suppressed, so it is
          // re-inserted explicitly after the marked range.
          const start = range.from + match[0].indexOf("#");
          state.tr
            .addMark(start, range.to, this.type.create({ tag: match[1] }))
            .insertText(" ", range.to)
            .removeStoredMark(this.type);
        },
      }),
    ];
  },

  markdownTokenName: "memoTag",
  parseMarkdown: (token, helpers) => {
    const t = token as MarkdownToken & { tag?: string };
    return helpers.createTextNode(t.raw ?? "", [{ type: "tag", attrs: { tag: t.tag ?? "" } }]);
  },
  // No delimiters: the literal `#tag` text carries the syntax.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});
