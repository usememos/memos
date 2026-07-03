// Port of internal/markdown: extracts #tags, @mentions and content properties
// from memo markdown. Uses remark (mdast) for block structure and regex-based
// inline scanning for the custom #tag/@mention syntax, mirroring the rules in
// internal/markdown/parser/{tag,mention}.go.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Content, Parent, Root } from "mdast";

export interface MemoProperty {
  hasLink: boolean;
  hasTaskList: boolean;
  hasCode: boolean;
  hasIncompleteTasks: boolean;
  title: string;
}

export interface ExtractedData {
  tags: string[];
  mentions: string[];
  property: MemoProperty;
}

const processor = unified().use(remarkParse).use(remarkGfm);

// Valid tag characters: Unicode letters/digits/symbols/marks, ZWJ, _-/&.
// Max 100 chars; `#` must not be followed by space or another `#`.
const TAG_PATTERN = /(?<!#)#([\p{L}\p{N}\p{S}\p{M}‍_\-/&]{1,100})/gu;
// Mentions: letters/digits/hyphen, must contain a letter or digit, and the
// character before @ must be a boundary (start, whitespace, punctuation).
const MENTION_PATTERN = /(?:^|(?<=[\s\p{P}\p{S}]))@([\p{L}\p{N}-]{1,100})/gu;

type Node = Root | Content;

function isParent(node: Node): node is Extract<Node, Parent> {
  return "children" in node;
}

function walk(node: Node, visit: (node: Node, ancestors: Node[]) => boolean | void, ancestors: Node[] = []): void {
  if (visit(node, ancestors) === false) {
    return;
  }
  if (isParent(node)) {
    for (const child of node.children) {
      walk(child as Node, visit, [...ancestors, node]);
    }
  }
}

function uniquePreserveCase(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

export function parseMarkdown(content: string): Root {
  return processor.parse(content) as Root;
}

export function extractAll(content: string): ExtractedData {
  const root = parseMarkdown(content);
  const tags: string[] = [];
  const mentions: string[] = [];
  const property: MemoProperty = { hasLink: false, hasTaskList: false, hasCode: false, hasIncompleteTasks: false, title: "" };

  // Title: first block-level child is an H1 heading.
  const firstBlock = root.children[0];
  if (firstBlock && firstBlock.type === "heading" && firstBlock.depth === 1) {
    property.title = mdastToString(firstBlock).trim();
  }

  walk(root, (node, ancestors) => {
    switch (node.type) {
      case "link":
        property.hasLink = true;
        break;
      case "code":
      case "inlineCode":
        property.hasCode = true;
        break;
      case "listItem":
        if (node.checked !== null && node.checked !== undefined) {
          property.hasTaskList = true;
          if (node.checked === false) {
            property.hasIncompleteTasks = true;
          }
        }
        break;
      case "text": {
        const insideLink = ancestors.some((a) => a.type === "link" || a.type === "image" || a.type === "linkReference");
        if (!insideLink) {
          for (const match of node.value.matchAll(TAG_PATTERN)) {
            tags.push(match[1]!);
          }
        }
        for (const match of node.value.matchAll(MENTION_PATTERN)) {
          mentions.push(match[1]!.toLowerCase());
        }
        break;
      }
      default:
        break;
    }
    // Skip scanning inside code blocks for tags/mentions.
    if (node.type === "code" || node.type === "inlineCode") {
      return false;
    }
    return undefined;
  });

  return {
    tags: uniquePreserveCase(tags),
    mentions: uniquePreserveCase(mentions),
    property,
  };
}

// Plain-text summary: skips code blocks, joins blocks with single spaces,
// truncates at a word boundary. Port of GenerateSnippet.
export function generateSnippet(content: string, maxLength = 64): string {
  const root = parseMarkdown(content);
  const parts: string[] = [];
  walk(root, (node) => {
    if (node.type === "code") {
      return false;
    }
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem" || node.type === "tableCell") {
      parts.push(mdastToString(node).replace(/\s+/g, " ").trim());
      return false;
    }
    return undefined;
  });
  let snippet = parts.filter((p) => p !== "").join(" ");
  if (snippet.length > maxLength) {
    const cut = snippet.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    snippet = `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
  }
  return snippet.trim();
}
