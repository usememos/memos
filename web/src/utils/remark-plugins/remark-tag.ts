import type { Root, Text } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Custom remark plugin for #tag syntax
 *
 * Parses #tag patterns in text nodes and converts them to HTML nodes.
 * This matches the goldmark backend TagNode implementation.
 *
 * Examples:
 *   #work → <span class="tag" data-tag="work">#work</span>
 *   #2024_plans → <span class="tag" data-tag="2024_plans">#2024_plans</span>
 *   #work-notes → <span class="tag" data-tag="work-notes">#work-notes</span>
 *   #tag1/subtag/subtag2 → <span class="tag" data-tag="tag1/subtag/subtag2">#tag1/subtag/subtag2</span>
 *
 * Rules:
 * - Tag must start with # followed by alphanumeric, underscore, hyphen, or forward slash
 * - Tag ends at whitespace, punctuation (except -, _, /), or end of line
 * - Tags at start of line after ## are headings, not tags
 */

/**
 * Check if character is valid for tag content
 */
function isTagChar(char: string): boolean {
  return /[a-zA-Z0-9_\-/]/.test(char);
}

/**
 * Parse tags from text and return segments
 */
function parseTagsFromText(text: string): Array<{ type: "text" | "tag"; value: string }> {
  const segments: Array<{ type: "text" | "tag"; value: string }> = [];
  let i = 0;

  while (i < text.length) {
    // Check for tag pattern
    if (text[i] === "#" && i + 1 < text.length && isTagChar(text[i + 1])) {
      // Check if this might be a heading (## at start or after whitespace)
      const prevChar = i > 0 ? text[i - 1] : "";
      const nextChar = i + 1 < text.length ? text[i + 1] : "";

      if (prevChar === "#" || nextChar === "#" || nextChar === " ") {
        // This is a heading, not a tag
        segments.push({ type: "text", value: text[i] });
        i++;
        continue;
      }

      // Extract tag content
      let j = i + 1;
      while (j < text.length && isTagChar(text[j])) {
        j++;
      }

      const tagContent = text.slice(i + 1, j);

      // Validate tag length
      if (tagContent.length > 0 && tagContent.length <= 100) {
        segments.push({ type: "tag", value: tagContent });
        i = j;
        continue;
      }
    }

    // Regular text
    let j = i + 1;
    while (j < text.length && text[j] !== "#") {
      j++;
    }
    segments.push({ type: "text", value: text.slice(i, j) });
    i = j;
  }

  return segments;
}

/**
 * Remark plugin to parse #tag syntax
 */
export const remarkTag = () => {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === null) return;

      const text = node.value;
      const segments = parseTagsFromText(text);

      // If no tags found, leave node as-is
      if (segments.every((seg) => seg.type === "text")) {
        return;
      }

      // Replace text node with multiple nodes (text + tag nodes)
      const newNodes = segments.map((segment) => {
        if (segment.type === "tag") {
          // Create a custom mdast node that remark-rehype will convert to <span>
          // This allows ReactMarkdown's component mapping (span: Tag) to work
          return {
            type: "tagNode" as any,
            value: segment.value,
            data: {
              hName: "span",
              hProperties: {
                className: "tag",
                "data-tag": segment.value,
              },
              hChildren: [{ type: "text", value: `#${segment.value}` }],
            },
          };
        } else {
          // Keep as text node
          return {
            type: "text" as const,
            value: segment.value,
          };
        }
      });

      // Replace the current node with the new nodes
      // @ts-expect-error - mdast types are complex, this is safe
      parent.children.splice(index, 1, ...newNodes);
    });
  };
};
