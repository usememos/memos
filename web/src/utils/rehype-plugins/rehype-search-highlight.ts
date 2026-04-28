import type { Element, Root, Text } from "hast";
import { SKIP, visit } from "unist-util-visit";

function isCodeElement(node: Element): boolean {
  return node.tagName === "code" || node.tagName === "pre";
}

function isTagOrMentionElement(node: Element): boolean {
  if (node.tagName !== "span") return false;
  const className = node.properties?.className;
  if (!className) return false;
  const classNames = Array.isArray(className) ? className : [className];
  return classNames.some((c) => typeof c === "string" && (c === "tag" || c === "mention"));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTextInNode(textNode: Text, keywords: string[], caseSensitive: boolean): (Text | Element)[] {
  const text = textNode.value;
  if (!text || keywords.length === 0) return [textNode];

  const flags = caseSensitive ? "g" : "gi";
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = sortedKeywords.map((k) => escapeRegExp(k)).join("|");
  const regex = new RegExp(`(${pattern})`, flags);

  const parts: (Text | Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: "element",
      tagName: "mark",
      properties: {
        className: ["search-highlight"],
        "data-search-match": match[0],
      },
      children: [
        {
          type: "text",
          value: match[0],
        },
      ],
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

interface RehypeSearchHighlightOptions {
  keywords: string[];
  caseSensitive?: boolean;
}

export const rehypeSearchHighlight = (options: RehypeSearchHighlightOptions) => {
  const { keywords, caseSensitive = false } = options;

  if (!keywords || keywords.length === 0) {
    return (tree: Root) => tree;
  }

  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (node.type === "element") {
        const element = node as Element;

        if (isCodeElement(element) || isTagOrMentionElement(element)) {
          return SKIP;
        }

        return;
      }

      if (node.type === "text" && parent && typeof index === "number") {
        const highlightedParts = highlightTextInNode(node as Text, keywords, caseSensitive);

        if (highlightedParts.length > 1 || (highlightedParts.length === 1 && highlightedParts[0].type === "element")) {
          const parentElement = parent as Element;
          parentElement.children.splice(index, 1, ...highlightedParts);
          return index + highlightedParts.length;
        }
      }
    });
  };
};
