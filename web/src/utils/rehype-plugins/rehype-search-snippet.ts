import type { Element, Root, RootContent, Text } from "hast";
import { SKIP, visit } from "unist-util-visit";

const BLOCK_ELEMENT_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "table", "pre", "hr", "div", "section"]);

const SKIP_ELEMENT_TAGS = new Set(["pre", "code", "iframe", "img"]);

interface BlockInfo {
  node: Element;
  hasMatch: boolean;
  matchCount: number;
  index: number;
}

function isBlockElement(node: Element): boolean {
  return BLOCK_ELEMENT_TAGS.has(node.tagName);
}

function isSkippableElement(node: Element): boolean {
  return SKIP_ELEMENT_TAGS.has(node.tagName);
}

function isTagOrMentionElement(node: Element): boolean {
  if (node.tagName !== "span") return false;
  const className = node.properties?.className;
  if (!className) return false;
  const classNames = Array.isArray(className) ? className : [className];
  return classNames.some((c) => typeof c === "string" && (c === "tag" || c === "mention"));
}

function shouldSkipForMatchCount(node: Element): boolean {
  return isSkippableElement(node) || isTagOrMentionElement(node);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTextContentExcludingSkipped(node: RootContent): string {
  let text = "";
  visit(node, (child) => {
    if (child.type === "element") {
      const element = child as Element;
      if (shouldSkipForMatchCount(element)) {
        return SKIP;
      }
    }
    if (child.type === "text") {
      text += (child as Text).value;
    }
  });
  return text;
}

function countMatchesInNode(node: Element, keywords: string[], caseSensitive: boolean): number {
  const text = getTextContentExcludingSkipped(node);
  if (!text) return 0;

  const flags = caseSensitive ? "g" : "gi";
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = sortedKeywords.map((k) => escapeRegExp(k)).join("|");
  const regex = new RegExp(pattern, flags);

  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function createEllipsisElement(): Element {
  return {
    type: "element",
    tagName: "p",
    properties: {
      className: ["search-ellipsis"],
    },
    children: [
      {
        type: "text",
        value: "…",
      },
    ],
  };
}

interface RehypeSearchSnippetOptions {
  keywords: string[];
  caseSensitive?: boolean;
  maxBlocks?: number;
  contextBlocks?: number;
}

export const rehypeSearchSnippet = (options: RehypeSearchSnippetOptions) => {
  const { keywords, caseSensitive = false, maxBlocks = 6, contextBlocks = 1 } = options;

  if (!keywords || keywords.length === 0) {
    return (tree: Root) => tree;
  }

  return (tree: Root) => {
    const rootChildren = tree.children;
    if (!rootChildren || rootChildren.length === 0) return;

    const blockElements: BlockInfo[] = [];
    let blockIndex = 0;

    visit(tree, (node, _index, parent) => {
      if (node.type === "element") {
        const element = node as Element;

        if (isSkippableElement(element) || isTagOrMentionElement(element)) {
          return SKIP;
        }

        if (parent && parent.type === "root" && isBlockElement(element)) {
          const matchCount = countMatchesInNode(element, keywords, caseSensitive);
          blockElements.push({
            node: element,
            hasMatch: matchCount > 0,
            matchCount,
            index: blockIndex++,
          });
        }
      }
    });

    if (blockElements.length === 0) return;

    const matchingBlocks = blockElements.filter((b) => b.hasMatch);
    if (matchingBlocks.length === 0) return;

    if (blockElements.length <= maxBlocks) {
      return;
    }

    let bestStartIndex = 0;
    let bestMatchCount = 0;

    for (let i = 0; i <= blockElements.length - maxBlocks; i++) {
      let windowMatchCount = 0;
      for (let j = 0; j < maxBlocks; j++) {
        windowMatchCount += blockElements[i + j].matchCount;
      }
      if (windowMatchCount > bestMatchCount) {
        bestMatchCount = windowMatchCount;
        bestStartIndex = i;
      }
    }

    if (bestMatchCount === 0) {
      return;
    }

    const actualContextBlocks = Math.min(contextBlocks, Math.floor(maxBlocks / 4));
    const adjustedStart = Math.max(0, bestStartIndex - actualContextBlocks);
    const adjustedEnd = Math.min(blockElements.length, adjustedStart + maxBlocks);

    const selectedBlocks = blockElements.slice(adjustedStart, adjustedEnd);

    const newChildren: RootContent[] = [];

    if (adjustedStart > 0) {
      newChildren.push(createEllipsisElement());
    }

    for (const block of selectedBlocks) {
      newChildren.push(block.node);
    }

    if (adjustedEnd < blockElements.length) {
      newChildren.push(createEllipsisElement());
    }

    tree.children = newChildren;
  };
};

interface ShouldUseSnippetOptions {
  content: string;
  keywords: string[];
  thresholdChars?: number;
}

export function shouldUseSearchSnippet(options: ShouldUseSnippetOptions): boolean {
  const { content, keywords, thresholdChars = 500 } = options;

  if (!keywords || keywords.length === 0) return false;
  if (content.length < thresholdChars) return false;

  const flags = "gi";
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = sortedKeywords.map((k) => escapeRegExp(k)).join("|");
  const regex = new RegExp(pattern, flags);

  const firstMatch = regex.exec(content);
  if (!firstMatch) return false;

  return firstMatch.index > 150;
}
