import { fromMarkdown } from "mdast-util-from-markdown";
import { decodeString } from "micromark-util-decode-string";
import { normalizeIdentifier } from "micromark-util-normalize-identifier";
import type { MarkdownSourceNode } from "@/utils/gfm-email";

export interface MarkdownSourceRange {
  from: number;
  to: number;
}

function childrenOf(node: MarkdownSourceNode): MarkdownSourceNode[] {
  const children: MarkdownSourceNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) children.push(child);
  return children;
}

function normalizeLabel(source: string): string {
  return normalizeIdentifier(decodeString(source).replaceAll("\0", "�"));
}

function labelValue(source: string, node: MarkdownSourceNode): string {
  return normalizeLabel(source.slice(node.from + 1, node.to - 1));
}

function linkTextValue(source: string, marks: MarkdownSourceNode[]): string {
  return normalizeLabel(source.slice(marks[0].to, marks[1].from));
}

/** Validate a Lezer reference definition against the CommonMark parser. */
export function isValidMarkdownLinkReference(source: string, node: MarkdownSourceNode): boolean {
  if (node.name !== "LinkReference") return false;
  return fromMarkdown(source.slice(node.from, node.to)).children.some((child) => child.type === "definition");
}

/**
 * Return only links that CommonMark actually resolves. Lezer also emits Link
 * nodes for unresolved reference labels and incomplete inline-link attempts;
 * those spellings remain ordinary text to the Markdown renderer.
 */
export function resolvedMarkdownLinkRanges(source: string, root: MarkdownSourceNode): MarkdownSourceRange[] {
  const definitions = new Set<string>();

  const collectDefinitions = (node: MarkdownSourceNode): void => {
    if (node.name === "LinkReference") {
      const label = childrenOf(node).find((child) => child.name === "LinkLabel");
      if (label && isValidMarkdownLinkReference(source, node)) definitions.add(labelValue(source, label));
      return;
    }
    for (let child = node.firstChild; child; child = child.nextSibling) collectDefinitions(child);
  };
  collectDefinitions(root);

  const ranges: MarkdownSourceRange[] = [];
  const collectLinks = (node: MarkdownSourceNode): void => {
    if (node.name === "Link" || node.name === "Image") {
      const children = childrenOf(node);
      const marks = children.filter((child) => child.name === "LinkMark");
      if (marks.length < 2) return;

      const labelClose = marks[1].to;
      const isCompleteInlineLink = source[labelClose] === "(" && node.to > labelClose && source[node.to - 1] === ")";
      const referenceLabel = children.find((child) => child.name === "LinkLabel" && child.from >= labelClose);
      const identifier =
        referenceLabel && referenceLabel.to - referenceLabel.from > 2 ? labelValue(source, referenceLabel) : linkTextValue(source, marks);

      if (isCompleteInlineLink || definitions.has(identifier)) {
        ranges.push({ from: node.from, to: node.to });
        return;
      }
      for (const child of children) collectLinks(child);
      return;
    }
    for (let child = node.firstChild; child; child = child.nextSibling) collectLinks(child);
  };
  collectLinks(root);
  return ranges.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function hasExactMarkdownRange(ranges: MarkdownSourceRange[], node: MarkdownSourceNode): boolean {
  return ranges.some((range) => range.from === node.from && range.to === node.to);
}
