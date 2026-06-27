import type { MarkdownToken } from "@tiptap/core";
import { InputRule, Mark, mergeAttributes } from "@tiptap/core";
import { mentionStyles } from "@/lib/markdownStyles";
import { isMentionChar, MENTION_RUN } from "@/utils/mention-grammar";

// Default mention accent, shared with the read-only view (MemoContent/Mention.tsx).
// Computed once — renderHTML runs on every view update.
const MENTION_CLASS = mentionStyles.base;

// Built from the shared MENTION_RUN (@/utils/mention-grammar) so the editor's
// input rule and tokenizer can't drift from the read-only renderer's lexer
// (web/src/utils/remark-plugins/remark-mention.ts). The `(?<![A-Za-z0-9-])`
// lookbehind in the input rule keeps `support@example` (and any `@` glued to a
// preceding word/username char) from forming a mention while typing.
const MENTION_INPUT_RULE = new RegExp(`(?<![A-Za-z0-9-])@(${MENTION_RUN})\\s$`);
const MENTION_TOKEN_RULE = new RegExp(`^@(${MENTION_RUN})`);

/**
 * Mark for memos `@mentions`: styled in the editor, serialized back to
 * `@username` verbatim. Modeled exactly like the Tag mark — a `code: true` text
 * mark (the PreservedInline pattern) so a mention inside `**bold**` or a link
 * label round-trips byte-identically and the literal `@a-b` text is emitted
 * unescaped. See Tag.ts for the full rationale on why this is a mark, not an
 * inline atom, and on going through the @tiptap/markdown manager.
 *
 * Unlike tags, mentions need no serialize-time escaping: an unintended `@word`
 * is byte-stable as plain text either way, and the read-only view already
 * decides styling by whether the username resolves to a real user, not by an
 * escape. Mentions inside link labels are likewise kept (the read-only renderer
 * keeps them too), so there is no strip-in-links pass.
 */
export const Mention = Mark.create({
  name: "mention",
  // Typing immediately after a mention must not extend it.
  inclusive: false,
  // Serializer emits the inner text verbatim, without escaping.
  code: true,

  addAttributes() {
    return {
      // The username without `@`. Stored as `username` but rendered/parsed as
      // `data-mention`, matching the read-only renderer's attribute.
      username: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mention") ?? "",
        renderHTML: (attributes) => ({ "data-mention": attributes.username }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-mention]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: MENTION_CLASS,
      }),
      0,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: MENTION_INPUT_RULE,
        handler: ({ state, range, match }) => {
          // Mark only from the `@`; the trailing space stays outside the mark
          // and is re-inserted explicitly (the handler's steps suppress the
          // typed space), mirroring the Tag input rule.
          const start = range.from + match[0].indexOf("@");
          state.tr
            .addMark(start, range.to, this.type.create({ username: match[1] }))
            .insertText(" ", range.to)
            .removeStoredMark(this.type);
        },
      }),
    ];
  },

  markdownTokenizer: {
    name: "memoMention",
    level: "inline",
    // Point marked only at an `@` that could *begin* a mention — one at a
    // boundary (string start, or a non-mention char before it). An `@` glued to
    // a preceding word/username char belongs to an email (`support@example.com`)
    // or the tail of `@a@b`; surfacing its index here would make marked split
    // the text at the `@` and rob its GFM autolinker of the contiguous email,
    // suppressing the mailto link. Skipping such `@`s leaves emails to autolink.
    start: (src: string) => {
      for (let i = src.indexOf("@"); i !== -1; i = src.indexOf("@", i + 1)) {
        if (i === 0 || !isMentionChar(src[i - 1])) {
          return i;
        }
      }
      return -1;
    },
    tokenize: (src: string, tokens: MarkdownToken[]) => {
      const match = MENTION_TOKEN_RULE.exec(src);
      if (!match) {
        return undefined;
      }
      // A mention only starts at a boundary. The previous token's last source
      // character is exactly the character before this `@`; if it is a mention
      // character the `@` is glued to a word or username (`support@example`,
      // the second `@` in `@a@b`) and must stay literal — mirroring the
      // read-only renderer's isMentionBoundary check (remark-mention.ts).
      const prevChar = (tokens[tokens.length - 1]?.raw ?? "").slice(-1);
      if (prevChar && isMentionChar(prevChar)) {
        return undefined;
      }
      return { type: "memoMention", raw: match[0], username: match[1] };
    },
  },
  markdownTokenName: "memoMention",
  parseMarkdown: (token, helpers) => {
    const t = token as MarkdownToken & { username?: string };
    return helpers.createTextNode(t.raw ?? "", [{ type: "mention", attrs: { username: t.username ?? "" } }]);
  },
  // No delimiters: the literal `@username` text carries the syntax.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});
