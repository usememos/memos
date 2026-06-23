import type { MarkdownToken } from "@tiptap/core";
import { InputRule, Mark, mergeAttributes } from "@tiptap/core";
import { tagStyles } from "@/lib/markdownStyles";
import { TAG_RUN } from "@/utils/tag-grammar";

// Default tag pill, shared with the read-only view (MemoContent/Tag.tsx).
// Computed once — renderHTML runs on every view update.
const TAG_CLASS = `${tagStyles.base} ${tagStyles.defaultColor}`;

// Built from the shared TAG_RUN (@/utils/tag-grammar) so the editor's input
// rule and tokenizer can't drift from the serialize-escape or the read-only
// renderer's lexer (web/src/utils/remark-plugins/remark-tag.ts). The capped-run
// lookahead in TAG_RUN also makes an over-long run decline to match — no
// separate length check needed.
const TAG_INPUT_RULE = new RegExp(`(?:^|\\s)#(${TAG_RUN})\\s$`, "u");
const TAG_TOKEN_RULE = new RegExp(`^#(${TAG_RUN})`, "u");

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
 * Parsed live while typing (the input rule) and from markdown (the
 * `markdownTokenizer` below — the canonical @tiptap/markdown extension point,
 * https://tiptap.dev/docs/editor/markdown/advanced-usage/custom-tokenizer).
 *
 * Two consequences of going through the manager (vs. registering on `marked`
 * directly) are handled in tagMarkdown.ts:
 *   - The tokenizer can't see whether it sits inside a link label — the manager
 *     forwards only `{ inlineTokens, blockTokens }`, not the lexer's `inLink`
 *     state — so tag-in-link skipping is a tree pass there, mirroring how the
 *     read-only renderer (remark-tag) skips link nodes.
 *   - The manager re-registers this tokenizer onto the global `marked` on every
 *     Editor construction (the accumulation noted in markdownCodec.ts). The
 *     impact is sub-millisecond for memo-sized content and the test codec is a
 *     singleton; accepted as the cost of the canonical API.
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

  markdownTokenizer: {
    name: "memoTag",
    level: "inline",
    start: (src: string) => src.indexOf("#"),
    tokenize: (src: string) => {
      const match = TAG_TOKEN_RULE.exec(src);
      if (!match) {
        return undefined;
      }
      // `#a#b`: decline when the run is directly followed by another `#`, so the
      // FIRST run stays plain text "#a" + tag "b" (`##x` likewise → text "#" +
      // tag "x"). The serialize-escape then escapes the tag-shaped literal "#a",
      // so `#a#b` round-trips as `\#a#b` — doc-equivalent and stable thereafter.
      // (An over-long run already declines: TAG_RUN's lookahead fails to match.)
      if (src.slice(match[0].length).startsWith("#")) {
        return undefined;
      }
      return { type: "memoTag", raw: match[0], tag: match[1] };
    },
  },
  markdownTokenName: "memoTag",
  parseMarkdown: (token, helpers) => {
    const t = token as MarkdownToken & { tag?: string };
    return helpers.createTextNode(t.raw ?? "", [{ type: "tag", attrs: { tag: t.tag ?? "" } }]);
  },
  // No delimiters: the literal `#tag` text carries the syntax.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});
