import { ensureSyntaxTree, syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { parser as markdownParser } from "@lezer/markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
import { decodeString } from "micromark-util-decode-string";
import { findMarkdownGFMEmailRanges, type GFMEmailSourceRange, type MarkdownSourceNode } from "@/utils/gfm-email";
import { findMarkdownGFMURLRanges } from "@/utils/gfm-url";
import {
  hasExactMarkdownRange,
  isValidMarkdownLinkReference,
  type MarkdownSourceRange,
  resolvedMarkdownLinkRanges,
} from "@/utils/markdown-link";
import { findDecodedMarkdownSourceBoundaries } from "@/utils/markdown-source-boundaries";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";
import { findMentionMatches, type MentionMatch } from "@/utils/mention-grammar";
import { findTagMatches, type TagMatch } from "@/utils/tag-grammar";
import { isUsernameCharacter } from "@/utils/username";

interface SourceRange {
  from: number;
  to: number;
}

type MarkdownNode = MarkdownSourceNode;

interface ParsedMarkdownContext {
  parsedTo: number;
  source: string;
  root: MarkdownNode;
  resolvedLinks: MarkdownSourceRange[];
  writtenURLRanges: MarkdownSourceRange[];
  emailRanges: GFMEmailSourceRange[];
  allowUnresolvedLinks: boolean;
}

const sourceParser = markdownParser.configure(memoMarkdownExtensions);
const REFERENCE_LABEL_PREFIX = "x ";
const REJECTED_URL_PREFIX = "x";
const parsedContextCache = new WeakMap<EditorState, ParsedMarkdownContext>();
let canonicalCodeCache: { source: string; ranges: SourceRange[] } | undefined;

function parsedMarkdownRoot(state: EditorState, to: number): MarkdownNode {
  return (ensureSyntaxTree(state, to) ?? syntaxTree(state)).topNode as MarkdownNode;
}

function parsedMarkdownContext(state: EditorState, to: number): ParsedMarkdownContext {
  const cached = parsedContextCache.get(state);
  if (cached && cached.parsedTo >= to) return cached;

  const source = state.doc.toString();
  const root = parsedMarkdownRoot(state, to);
  const resolvedLinks = resolvedMarkdownLinkRanges(source, root);
  const allowUnresolvedLinks = syntaxTreeAvailable(state);
  const context = {
    parsedTo: to,
    source,
    root,
    resolvedLinks,
    writtenURLRanges: findMarkdownGFMURLRanges(source, root, resolvedLinks),
    emailRanges: findMarkdownGFMEmailRanges(source, root, resolvedLinks, allowUnresolvedLinks),
    allowUnresolvedLinks,
  };
  parsedContextCache.set(state, context);
  return context;
}

// Only these known textual containers expose their direct source gaps. Their
// syntax children are boundaries: transparent children recurse, while links,
// code, math, HTML syntax, escapes, entities, and future extension nodes are
// opaque by default.
const TEXT_CONTAINERS = new Set([
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
  "Emphasis",
  "Paragraph",
  "SetextHeading1",
  "SetextHeading2",
  "Strikethrough",
  "StrongEmphasis",
  "TableCell",
  "Task",
]);

const STRUCTURAL_CONTAINERS = new Set([
  "Blockquote",
  "BulletList",
  "Document",
  "ListItem",
  "OrderedList",
  "Table",
  "TableHeader",
  "TableRow",
]);

function addClampedRange(ranges: SourceRange[], from: number, to: number, lowerBound: number, upperBound: number): void {
  const clampedFrom = Math.max(from, lowerBound);
  const clampedTo = Math.min(to, upperBound);
  if (clampedFrom < clampedTo) ranges.push({ from: clampedFrom, to: clampedTo });
}

function collectUnresolvedReferenceLabelRanges(node: MarkdownNode, from: number, to: number, source: string, ranges: SourceRange[]): void {
  const contentFrom = node.from + 1;
  const contentTo = node.to - 1;
  if (contentFrom >= contentTo) return;

  // Lezer keeps an unresolved second label as one opaque LinkLabel node. Parse
  // its contents again as ordinary inline Markdown so emphasis, escapes, and
  // other syntax retain their normal boundaries after link resolution fails.
  const prefixedSource = REFERENCE_LABEL_PREFIX + source.slice(contentFrom, contentTo);
  const root = sourceParser.parse(prefixedSource).topNode as MarkdownNode;
  const resolvedLinks = resolvedMarkdownLinkRanges(prefixedSource, root);
  const writtenURLs = findMarkdownGFMURLRanges(prefixedSource, root, resolvedLinks, false).filter(
    (range) => range.from !== REFERENCE_LABEL_PREFIX.length,
  );
  const labelRanges: SourceRange[] = [];
  collectLiteralRanges(
    root,
    REFERENCE_LABEL_PREFIX.length,
    prefixedSource.length,
    prefixedSource,
    resolvedLinks,
    writtenURLs,
    true,
    labelRanges,
  );
  for (const range of labelRanges) {
    const offset = contentFrom - REFERENCE_LABEL_PREFIX.length;
    addClampedRange(ranges, range.from + offset, range.to + offset, from, to);
  }
}

function collectRejectedURLLiteralRanges(
  parent: MarkdownNode,
  node: MarkdownNode,
  from: number,
  to: number,
  source: string,
  ranges: SourceRange[],
): void {
  const prefixedSource = REJECTED_URL_PREFIX + source.slice(node.from, node.to);
  const root = sourceParser.parse(prefixedSource).topNode as MarkdownNode;
  const resolvedLinks = resolvedMarkdownLinkRanges(prefixedSource, root);
  const urlRanges: SourceRange[] = [];
  collectLiteralRanges(
    root,
    REJECTED_URL_PREFIX.length,
    prefixedSource.length,
    prefixedSource,
    resolvedLinks,
    findMarkdownGFMURLRanges(prefixedSource, root, resolvedLinks, false),
    true,
    urlRanges,
  );

  const offset = node.from - REJECTED_URL_PREFIX.length;
  const projected = urlRanges.map((range) => ({ from: range.from + offset, to: range.to + offset }));
  const emphasisMarks: SourceRange[] = [];
  if (source.slice(node.from, node.to).includes("_") && source.slice(parent.from, node.from).includes("_")) {
    const insertion = node.from - parent.from;
    const contextualSource = source.slice(parent.from, node.from) + REJECTED_URL_PREFIX + source.slice(node.from, node.to);
    const contentFrom = insertion + REJECTED_URL_PREFIX.length;
    sourceParser.parse(contextualSource).iterate({
      enter(mark) {
        if (mark.name === "EmphasisMark" && mark.from >= contentFrom) {
          emphasisMarks.push({
            from: mark.from + parent.from - REJECTED_URL_PREFIX.length,
            to: mark.to + parent.from - REJECTED_URL_PREFIX.length,
          });
        }
      },
    });
  }
  for (const range of subtractRanges(projected, emphasisMarks)) {
    addClampedRange(ranges, range.from, range.to, from, to);
  }
}

function canonicalSourceKeepsCodeOpaque(source: string, node: MarkdownNode): boolean {
  if (canonicalCodeCache?.source !== source) {
    const ranges: SourceRange[] = [];
    const collectRanges = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== "object") return;
      const value = candidate as {
        type?: string;
        position?: { start?: { offset?: number }; end?: { offset?: number } };
        children?: unknown[];
      };
      const from = value.position?.start?.offset;
      const to = value.position?.end?.offset;
      if (value.type === "code" && from !== undefined && to !== undefined) ranges.push({ from, to });
      value.children?.forEach(collectRanges);
    };
    collectRanges(fromMarkdown(source));
    canonicalCodeCache = { source, ranges };
  }

  return canonicalCodeCache.ranges.some((range) => range.from <= node.from && range.to >= node.to);
}

function collectReparsedLiteralRanges(node: MarkdownNode, from: number, to: number, source: string, ranges: SourceRange[]): void {
  const prefix = "x ";
  const prefixedSource = prefix + source.slice(node.from, node.to);
  const root = sourceParser.parse(prefixedSource).topNode as MarkdownNode;
  const resolvedLinks = resolvedMarkdownLinkRanges(prefixedSource, root);
  const reparsed: SourceRange[] = [];
  collectLiteralRanges(
    root,
    prefix.length,
    prefixedSource.length,
    prefixedSource,
    resolvedLinks,
    findMarkdownGFMURLRanges(prefixedSource, root, resolvedLinks, false),
    true,
    reparsed,
  );
  const offset = node.from - prefix.length;
  for (const range of reparsed) addClampedRange(ranges, range.from + offset, range.to + offset, from, to);
}

function collectLiteralRanges(
  node: MarkdownNode,
  from: number,
  to: number,
  source: string,
  resolvedLinks: MarkdownSourceRange[],
  writtenURLs: MarkdownSourceRange[],
  allowUnresolvedLinks: boolean,
  ranges: SourceRange[],
): void {
  if (node.to <= from || node.from >= to) return;

  const unresolvedLinkLike =
    allowUnresolvedLinks && (node.name === "Link" || node.name === "Image") && !hasExactMarkdownRange(resolvedLinks, node);
  const invalidLinkReference = node.name === "LinkReference" && !isValidMarkdownLinkReference(source, node);
  const scansDirectText = TEXT_CONTAINERS.has(node.name) || unresolvedLinkLike || invalidLinkReference;
  if (!scansDirectText && !STRUCTURAL_CONTAINERS.has(node.name)) return;

  let cursor = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "Entity") {
      const spelling = source.slice(child.from, child.to);
      if (decodeString(spelling) === spelling) continue;
    }
    if (child.to <= cursor) continue;
    if (scansDirectText) addClampedRange(ranges, cursor, child.from, from, to);
    if (child.from >= cursor) {
      if (node.name === "Blockquote" && child.name === "CodeBlock" && !canonicalSourceKeepsCodeOpaque(source, child)) {
        collectReparsedLiteralRanges(child, from, to, source, ranges);
      } else if (invalidLinkReference && child.name === "LinkLabel") {
        collectUnresolvedReferenceLabelRanges(child, from, to, source, ranges);
      } else if (child.name === "URL") {
        if (!hasExactMarkdownRange(writtenURLs, child)) collectRejectedURLLiteralRanges(node, child, from, to, source, ranges);
      } else if (unresolvedLinkLike && child.name === "LinkLabel") {
        collectUnresolvedReferenceLabelRanges(child, from, to, source, ranges);
      } else {
        collectLiteralRanges(child, from, to, source, resolvedLinks, writtenURLs, allowUnresolvedLinks, ranges);
      }
    }
    cursor = Math.max(cursor, child.to);
  }
  if (scansDirectText) addClampedRange(ranges, cursor, node.to, from, to);
}

function subtractRanges(ranges: SourceRange[], opaqueRanges: SourceRange[]): SourceRange[] {
  return ranges.flatMap((range) => {
    const pieces: SourceRange[] = [];
    let cursor = range.from;
    for (const opaque of opaqueRanges) {
      if (opaque.to <= cursor || opaque.from >= range.to) continue;
      if (cursor < opaque.from) pieces.push({ from: cursor, to: Math.min(opaque.from, range.to) });
      cursor = Math.max(cursor, opaque.to);
      if (cursor >= range.to) break;
    }
    if (cursor < range.to) pieces.push({ from: cursor, to: range.to });
    return pieces;
  });
}

function mergeSourceRanges(ranges: SourceRange[]): SourceRange[] {
  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to);
  const merged: SourceRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.from <= previous.to) previous.to = Math.max(previous.to, range.to);
    else merged.push({ ...range });
  }
  return merged;
}

export function literalMarkdownSourceRanges(state: EditorState, from: number, to: number): SourceRange[] {
  const ranges: SourceRange[] = [];
  const context = parsedMarkdownContext(state, to);
  collectLiteralRanges(
    context.root,
    from,
    to,
    context.source,
    context.resolvedLinks,
    context.writtenURLRanges,
    context.allowUnresolvedLinks,
    ranges,
  );
  const decodedBoundaries = findDecodedMarkdownSourceBoundaries(context.source, from, to);
  return mergeSourceRanges(
    subtractRanges(subtractRanges(subtractRanges(ranges, decodedBoundaries), context.emailRanges), context.writtenURLRanges),
  );
}

/** Find tags only in literal Markdown source exposed by the editor syntax tree. */
export function findMarkdownTagMatches(state: EditorState, from: number, to: number): TagMatch[] {
  const matches: TagMatch[] = [];
  for (const range of literalMarkdownSourceRanges(state, from, to)) {
    const source = state.doc.sliceString(range.from, range.to);
    for (const match of findTagMatches(source)) {
      matches.push({ ...match, from: range.from + match.from, to: range.from + match.to });
    }
  }
  return matches;
}

/** Find username references only in literal Markdown source exposed by the editor syntax tree. */
export function findMarkdownMentionMatches(state: EditorState, from: number, to: number): MentionMatch[] {
  const matches: MentionMatch[] = [];
  for (const range of literalMarkdownSourceRanges(state, from, to)) {
    const source = state.doc.sliceString(range.from, range.to);
    const runHasLeftBoundary = range.from === 0 || !isUsernameCharacter(state.doc.sliceString(range.from - 1, range.from));
    for (const match of findMentionMatches(source, runHasLeftBoundary)) {
      matches.push({ ...match, from: range.from + match.from, to: range.from + match.to });
    }
  }
  return matches;
}

/** Return the active tag whose recognized source span ends at the cursor. */
export function tagMatchBefore(state: EditorState, position: number): TagMatch | undefined {
  const line = state.doc.lineAt(position);
  const matches = findMarkdownTagMatches(state, line.from, position);
  return matches.findLast((match) => match.to === position);
}

/** Whether an offset is in a literal-source run (used for explicit `#` completion). */
export function isLiteralTagPosition(state: EditorState, position: number): boolean {
  const line = state.doc.lineAt(position);
  return literalMarkdownSourceRanges(state, line.from, position).some((range) => range.to === position);
}
