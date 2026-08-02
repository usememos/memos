import { decodeString } from "micromark-util-decode-string";
import type { MarkdownSourceNode } from "@/utils/gfm-email";
import { hasExactMarkdownRange, isValidMarkdownLinkReference, type MarkdownSourceRange } from "@/utils/markdown-link";

export interface GFMURLSourceRange {
  from: number;
  to: number;
}

const UNICODE_ALPHANUMERIC = /[\p{L}\p{N}]/u;
const UNICODE_SEPARATOR = /\p{Z}/u;
const TRAILING_PUNCTUATION = new Set(["!", '"', "'", "*", ",", ".", ":", ";", "?", "_", "~"]);

function prefixEnd(source: string, from: number): number | undefined {
  if (source.startsWith("https://", from)) return from + "https://".length;
  if (source.startsWith("http://", from)) return from + "http://".length;
  if (source.startsWith("www.", from)) return from + "www.".length;
  return undefined;
}

function domainCharacterSize(source: string, offset: number): number {
  const char = String.fromCodePoint(source.codePointAt(offset) ?? 0);
  return char === "_" || char === "-" || char === "." || UNICODE_ALPHANUMERIC.test(char) ? char.length : 0;
}

function hasValidDomain(source: string, from: number, to: number): boolean {
  while (to > from && source[to - 1] === ".") to--;
  const segments = source.slice(from, to).split(".");
  return segments.length >= 2 && segments.every(Boolean) && !segments.at(-2)?.includes("_") && !segments.at(-1)?.includes("_");
}

function trimGFMURLTail(source: string, from: number, to: number): number {
  const path = source.slice(from, to);
  let openParentheses = 0;
  let closeParentheses = 0;
  for (const character of path) {
    if (character === "(") openParentheses++;
    else if (character === ")") closeParentheses++;
  }

  while (to > from) {
    const entity = source.slice(from, to).match(/&[A-Za-z]+;$/)?.[0];
    if (entity) {
      to -= entity.length;
      continue;
    }

    const character = source[to - 1];
    if (character === ")" && closeParentheses > openParentheses) {
      closeParentheses--;
      to--;
      continue;
    }
    if (character === "]" || TRAILING_PUNCTUATION.has(character)) {
      to--;
      continue;
    }
    break;
  }
  return to;
}

/** Return the complete source range of a lowercase written GFM URL at `from`. */
export function writtenGFMURLSourceRange(source: string, from: number, upperBound = source.length): GFMURLSourceRange | undefined {
  const domainFrom = prefixEnd(source, from);
  if (domainFrom === undefined || domainFrom >= upperBound) return undefined;

  let domainTo = domainFrom;
  while (domainTo < upperBound) {
    const size = domainCharacterSize(source, domainTo);
    if (size === 0) break;
    domainTo += size;
  }
  if (!hasValidDomain(source, domainFrom, domainTo)) return undefined;

  let to = domainTo;
  while (to < upperBound) {
    const character = String.fromCodePoint(source.codePointAt(to) ?? 0);
    const code = source.charCodeAt(to);
    if (source[to] === "<" || (code >= 0x09 && code <= 0x0d) || UNICODE_SEPARATOR.test(character)) break;
    to += character.length;
  }
  return { from, to: trimGFMURLTail(source, from, to) };
}

/** Whether a complete source spelling is a written GFM URL. */
export function isWrittenGFMURLSource(source: string): boolean {
  return writtenGFMURLSourceRange(source, 0)?.to === source.length;
}

function hasWrittenURLBoundary(source: string, from: number, contextFrom: number, allowInitialBOM: boolean): boolean {
  if (from === contextFrom) return true;
  if (allowInitialBOM && contextFrom === 0 && from === 1 && source[0] === "\uFEFF") return true;
  const previous = source[from - 1];
  const code = source.charCodeAt(from - 1);
  return (code >= 0x09 && code <= 0x0d) || previous === " " || previous === "(" || previous === "*" || previous === "_" || previous === "~";
}

/** Return a written GFM URL only when it starts in a valid source context. */
export function writtenGFMURLSourceRangeAt(
  source: string,
  from: number,
  contextFrom: number,
  upperBound = source.length,
  allowInitialBOM = true,
): GFMURLSourceRange | undefined {
  if (!hasWrittenURLBoundary(source, from, contextFrom, allowInitialBOM)) return undefined;
  return writtenGFMURLSourceRange(source, from, upperBound);
}

/** Find written GFM URLs in one already-classified literal source run. */
export function findWrittenGFMURLRanges(
  source: string,
  lowerBound = 0,
  upperBound = source.length,
  contextFrom = lowerBound,
  opaqueRanges: GFMURLSourceRange[] = [],
  allowInitialBOM = true,
): GFMURLSourceRange[] {
  const ranges: GFMURLSourceRange[] = [];
  let opaqueIndex = 0;
  for (let offset = contextFrom; offset < upperBound; ) {
    while (opaqueIndex < opaqueRanges.length && opaqueRanges[opaqueIndex].to <= offset) opaqueIndex++;
    const opaque = opaqueRanges[opaqueIndex];
    if (opaque && opaque.from <= offset && opaque.to > offset) {
      offset = opaque.to;
      continue;
    }

    if (offset >= lowerBound) {
      const range = writtenGFMURLSourceRangeAt(source, offset, contextFrom, upperBound, allowInitialBOM);
      if (range) {
        ranges.push(range);
        offset = range.to;
        continue;
      }
    }

    offset++;
  }
  return ranges;
}

const URL_SOURCE_CONTAINERS = new Set([
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
  "Paragraph",
  "SetextHeading1",
  "SetextHeading2",
  "TableCell",
  "Task",
]);

const URL_PREFIX_OPAQUE_NODES = new Set([
  "Autolink",
  "BlockMath",
  "Comment",
  "Escape",
  "HTMLBlock",
  "HTMLTag",
  "InlineCode",
  "InlineMath",
  "ProcessingInstruction",
]);

function opaqueURLPrefixRanges(source: string, container: MarkdownSourceNode, resolvedLinks: MarkdownSourceRange[]): GFMURLSourceRange[] {
  const ranges: GFMURLSourceRange[] = [];

  const collect = (node: MarkdownSourceNode): void => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      const resolvedLinkLike = (child.name === "Link" || child.name === "Image") && hasExactMarkdownRange(resolvedLinks, child);
      const knownEntity =
        child.name === "Entity" && decodeString(source.slice(child.from, child.to)) !== source.slice(child.from, child.to);
      if (resolvedLinkLike || knownEntity || URL_PREFIX_OPAQUE_NODES.has(child.name)) {
        ranges.push({ from: child.from, to: child.to });
      } else {
        collect(child);
      }
    }
  };

  collect(container);
  return ranges.sort((left, right) => left.from - right.from || left.to - right.to);
}

/** Find canonical written GFM URLs using Markdown syntax for bracket context. */
export function findMarkdownGFMURLRanges(
  source: string,
  root: MarkdownSourceNode,
  resolvedLinks: MarkdownSourceRange[],
  allowInitialBOM = true,
): GFMURLSourceRange[] {
  const ranges: GFMURLSourceRange[] = [];

  const collect = (node: MarkdownSourceNode): void => {
    const invalidLinkReference = node.name === "LinkReference" && !isValidMarkdownLinkReference(source, node);
    if (URL_SOURCE_CONTAINERS.has(node.name) || invalidLinkReference) {
      ranges.push(
        ...findWrittenGFMURLRanges(
          source,
          node.from,
          node.to,
          node.from,
          opaqueURLPrefixRanges(source, node, resolvedLinks),
          allowInitialBOM,
        ),
      );
      return;
    }
    for (let child = node.firstChild; child; child = child.nextSibling) collect(child);
  };

  collect(root);
  return ranges.sort((left, right) => left.from - right.from || left.to - right.to);
}
