import type { MarkdownParseHelpers, MarkdownToken } from "@tiptap/core";
import { Extension, Mark, mergeAttributes, Node } from "@tiptap/core";
import type { Tokens } from "marked";
import { marked } from "marked";

/**
 * Fidelity workhorse for syntax the WYSIWYG editor does not model (tables,
 * math, raw HTML). Constructs are captured at parse time with their raw
 * markdown source, shown as editable literal mono text, and re-emitted
 * byte-for-byte on serialize. `code: true` keeps the serializer from
 * escaping/entity-encoding the inner text.
 */
export const PreservedBlock = Node.create({
  name: "preservedBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  parseHTML() {
    return [{ tag: "pre[data-preserved-block]", preserveWhitespace: "full" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-preserved-block": "",
        class: "font-mono text-sm opacity-80 whitespace-pre-wrap my-0",
      }),
      0,
    ];
  },

  // The literal source is the node's text; Document joins blocks with \n\n.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});

/** Inline counterpart: a `code: true` mark that emits its text verbatim. */
export const PreservedInline = Mark.create({
  name: "preservedInline",
  code: true,

  parseHTML() {
    return [{ tag: "span[data-preserved-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-preserved-inline": "", class: "font-mono opacity-80" }), 0];
  },

  // No delimiters: the preserved text already contains its own syntax.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});

// Note: `MarkdownParseResult` in @tiptap/core 3.26.0 does not admit `null`;
// the manager treats an empty array as "handler declined" (it requires
// `normalized.length > 0` before accepting a result), so `[]` is the
// type-safe way to fall through to the next handler / fallback.
function preservedBlockFromToken(token: MarkdownToken, helpers: MarkdownParseHelpers) {
  const source = (token.raw ?? "").replace(/\n+$/, "");
  if (!source) {
    return [];
  }
  return helpers.createNode("preservedBlock", {}, [helpers.createTextNode(source)]);
}

/** Inline counterpart: the token's raw source as preservedInline-marked text. */
function preservedInlineFromToken(token: MarkdownToken, helpers: MarkdownParseHelpers) {
  return helpers.createTextNode(token.raw ?? "", [{ type: "preservedInline" }]);
}

/** Routes marked's `table` tokens into preservedBlock instead of dropping them. */
export const PreservedTableBridge = Extension.create({
  name: "preservedTableBridge",
  markdownTokenName: "table",
  parseMarkdown: preservedBlockFromToken,
});

/**
 * Routes block-level raw HTML into preservedBlock. Inline HTML never reaches
 * the handler registry (the markdown manager intercepts it and would convert
 * recognized tags like <em> into marks), so inline tags are captured earlier
 * by the custom tokenizer in PreservedHtmlInlineBridge below.
 */
export const PreservedHtmlBlockBridge = Extension.create({
  name: "preservedHtmlBlockBridge",
  markdownTokenName: "html",
  parseMarkdown: (token, helpers) => {
    if (!token.block) {
      return [];
    }
    return preservedBlockFromToken(token, helpers);
  },
});

function tokenizePreservedHtmlInline(src: string): Tokens.Generic | undefined {
  // One HTML comment, or one opening/closing/self-closing HTML tag. For
  // tags, the first character after `<` (or `</`) must be a letter and the
  // tag name only [a-zA-Z0-9-], followed by attributes/`>` — this never
  // matches autolinks such as <https://example.com> or <mail@example.com>
  // (`:`/`@` break the match). Attribute values are matched quote-aware so
  // `>` inside a quoted value (e.g. data-x="1 > 0") does not end the tag.
  // The alternatives are disjoint: the catch-all class [^<>"'] excludes both
  // quote characters so it cannot overlap with the quoted branches, which
  // eliminates catastrophic backtracking on unterminated tags with many quotes.
  const match = /^(?:<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s(?:"[^"]*"|'[^']*'|[^<>"'])*)?\/?>)/.exec(src);
  if (!match) {
    return undefined;
  }
  return { type: "preservedHtmlInline", raw: match[0], text: match[0] };
}

function tokenizePreservedMathBlock(src: string): Tokens.Generic | undefined {
  // Anchored to line geometry: opens at line start (guaranteed by marked
  // handing us `src` from the current block position) and closes with `$$`
  // at end-of-line. Trailing newlines are NOT consumed into `raw` (the
  // `(?=\n|$)` lookahead): marked tolerates this for block tokens — its
  // "space" tokenizer absorbs the leftover `\n` and the following block
  // tokenizes normally (verified by the round-trip tests). Either way,
  // "$$\nx\n$$\nnext" serializes as "$$\nx\n$$\n\nnext": the \n\n comes
  // from the Document serializer joining sibling blocks, and
  // preservedBlockFromToken strips trailing \n from raw regardless — so
  // we keep raw minimal rather than swallow separators we don't re-emit.
  const match = /^\$\$[\s\S]+?\$\$(?=\n|$)/.exec(src);
  if (!match) {
    return undefined;
  }
  return { type: "preservedMathBlock", raw: match[0], text: match[0] };
}

function tokenizePreservedMathInline(src: string): Tokens.Generic | undefined {
  const match = /^\$[^$\n]+\$/.exec(src);
  if (!match) {
    return undefined;
  }
  return { type: "preservedMathInline", raw: match[0], text: match[0] };
}

/**
 * The three preserved-syntax tokenizers are registered DIRECTLY on the global
 * marked singleton, module-scope and idempotent — the Tag.ts pattern (see the
 * rationale there). Routing them through each Extension's `markdownTokenizer`
 * would make every `new Editor()` re-register them on the shared `marked`
 * instance forever (the accumulation hazard documented in markdownCodec.ts).
 * The Extensions below keep `markdownTokenName` + `parseMarkdown`, which is
 * all the manager needs to route the tokens.
 */
let preservedTokenizersRegistered = false;
function registerPreservedTokenizers() {
  if (preservedTokenizersRegistered) {
    return;
  }
  preservedTokenizersRegistered = true;
  marked.use({
    extensions: [
      {
        name: "preservedHtmlInline",
        level: "inline",
        start: (src: string) => src.indexOf("<"),
        tokenizer: tokenizePreservedHtmlInline,
      },
      {
        name: "preservedMathBlock",
        level: "block",
        // Marked truncates the preceding paragraph at whatever index `start`
        // returns, even if `tokenizer` then declines — so only report `$$` that
        // sits at the start of a line, never a mid-line `$$` (e.g. "costs $$").
        // Marked invokes block `start` callbacks exclusively from its paragraph
        // interrupt check, on `src.slice(1)` — index 0 of the string we receive
        // is always mid-line, so a `^`-anchored branch would false-positive
        // (e.g. "$$$$" → "$\n$\n$$"). Only a `$$` right after `\n` is line-start.
        start: (src: string) => {
          const match = /\n\$\$/.exec(src);
          return match ? match.index + 1 : -1;
        },
        tokenizer: tokenizePreservedMathBlock,
      },
      {
        name: "preservedMathInline",
        level: "inline",
        start: (src: string) => src.indexOf("$"),
        tokenizer: tokenizePreservedMathInline,
      },
    ],
  });
}
registerPreservedTokenizers();

export const PreservedHtmlInlineBridge = Extension.create({
  name: "preservedHtmlInlineBridge",
  markdownTokenName: "preservedHtmlInline",
  parseMarkdown: preservedInlineFromToken,
});

export const PreservedMathBlockBridge = Extension.create({
  name: "preservedMathBlockBridge",
  markdownTokenName: "preservedMathBlock",
  parseMarkdown: preservedBlockFromToken,
});

export const PreservedMathInlineBridge = Extension.create({
  name: "preservedMathInlineBridge",
  markdownTokenName: "preservedMathInline",
  parseMarkdown: preservedInlineFromToken,
});

export const preservedExtensions = [
  PreservedBlock,
  PreservedInline,
  PreservedTableBridge,
  PreservedHtmlBlockBridge,
  PreservedHtmlInlineBridge,
  PreservedMathBlockBridge,
  PreservedMathInlineBridge,
];
