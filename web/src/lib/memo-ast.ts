import {
  type ContentSource,
  footnotes,
  type InlineNode,
  type MarkdownOptions,
  type MarkdownSyntax,
  math,
  mentions,
  parseAst,
  type Root,
  type TreeNode,
  tags,
  visit,
} from "@usememos/editor";

/**
 * The memo Markdown dialect, shared by the composer and the read-only memo view
 * so a memo reads the same while editing and after saving: a single newline is
 * a line break, and setext headings are off, so a line
 * followed by `---` stays a paragraph and a divider.
 */
export const MEMO_MARKDOWN: MarkdownOptions = { breaks: true, setext: false };

/**
 * The syntax the memo extensions add (math, footnotes, and the escapes of tags and
 * mentions), for parsing outside an editor. `memoExtensions` in memo-markdown renders it.
 */
export const MEMO_SYNTAX: readonly MarkdownSyntax[] = [math(), footnotes(), tags(), mentions()].flatMap((extension) =>
  extension.markdown ? [extension.markdown] : [],
);

/** A memo's syntax tree, as the composer and the memo view read it. */
export const parseMemoAst = (markdown: string): Root => parseAst(markdown, { ...MEMO_MARKDOWN, syntax: MEMO_SYNTAX });

/**
 * Calls `visitor` for every node in document order, as `visit` does, and gives an inline
 * node the content source its `pos` counts from (its paragraph's or heading's, or its
 * table cell's), for `sourceRange`.
 */
export const visitWithSource = (root: Root, visitor: (node: TreeNode, source?: ContentSource) => void): void => {
  const walk = (nodes: readonly InlineNode[], source: ContentSource | undefined) => {
    for (const inline of nodes) visit(inline, (node) => visitor(node, source));
  };
  visit(root, (node) => {
    visitor(node);
    if (node.type === "paragraph" || node.type === "heading") {
      walk(node.children, node.source);
      return false;
    }
    if (node.type === "table") {
      node.rows.forEach((row, r) => row.forEach((cell, c) => walk(cell, node.sources?.[r]?.[c])));
      return false;
    }
  });
};
