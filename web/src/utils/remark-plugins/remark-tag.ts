import type { Root, Text } from "mdast";
import { visit } from "unist-util-visit";

const MAX_TAG_LENGTH = 100;

// Check if character is valid for tag content (Unicode letters, digits, symbols, _, -, /)
function isTagChar(char: string): boolean {
  // Allow Unicode letters (any script)
  if (/\p{L}/u.test(char)) {
    return true;
  }

  // Allow Unicode digits
  if (/\p{N}/u.test(char)) {
    return true;
  }

  // Allow Unicode symbols (includes emoji)
  // This makes tags compatible with social media platforms
  if (/\p{S}/u.test(char)) {
    return true;
  }

  // Allow specific symbols for tag structure
  // Underscore: word separation (snake_case)
  // Hyphen: word separation (kebab-case)
  // Forward slash: hierarchical tags (category/subcategory)
  if (char === "_" || char === "-" || char === "/") {
    return true;
  }

  // Everything else is invalid (whitespace, punctuation, control chars)
  return false;
}

// Parse tags from text and return segments
function parseTagsFromText(text: string): Array<{ type: "text" | "tag"; value: string }> {
  const segments: Array<{ type: "text" | "tag"; value: string }> = [];

  // Convert to array of code points for proper Unicode handling (emojis, etc.)
  const chars = [...text];
  let i = 0;

  while (i < chars.length) {
    // Check for tag pattern
    if (chars[i] === "#" && i + 1 < chars.length && isTagChar(chars[i + 1])) {
      // Check if this might be a heading (## at start or after whitespace)
      const prevChar = i > 0 ? chars[i - 1] : "";
      const nextChar = i + 1 < chars.length ? chars[i + 1] : "";

      if (prevChar === "#" || nextChar === "#" || nextChar === " ") {
        // This is a heading, not a tag
        segments.push({ type: "text", value: chars[i] });
        i++;
        continue;
      }

      // Extract tag content
      let j = i + 1;
      while (j < chars.length && isTagChar(chars[j])) {
        j++;
      }

      const tagContent = chars.slice(i + 1, j).join("");

      // Validate tag length by rune count (must match backend MAX_TAG_LENGTH)
      const runeCount = [...tagContent].length;
      if (runeCount > 0 && runeCount <= MAX_TAG_LENGTH) {
        segments.push({ type: "tag", value: tagContent });
        i = j;
        continue;
      }
    }

    // Regular text
    let j = i + 1;
    while (j < chars.length && chars[j] !== "#") {
      j++;
    }
    segments.push({ type: "text", value: chars.slice(i, j).join("") });
    i = j;
  }

  return segments;
}

// Remark plugin to parse #tag syntax
export const remarkTag = () => {
  return (tree: Root) => {
    // Process text nodes in all node types (paragraphs, headings, etc.)
    visit(tree, (node: any, index, parent) => {
      // Only process text nodes that have a parent and index
      if (node.type !== "text" || !parent || index === null) return;

      const textNode = node as Text;
      const text = textNode.value;
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
      parent.children.splice(index, 1, ...newNodes);
    });
  };
};
