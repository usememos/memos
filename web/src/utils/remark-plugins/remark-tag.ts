import { parser as markdownParser } from "@lezer/markdown";
import type { Link, Root, Text } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { decodeString } from "micromark-util-decode-string";
import type { Node as UnistNode } from "unist";
import type { MentionNode, MentionNodeData, TagNode, TagNodeData } from "@/types/markdown";
import { findMarkdownGFMEmailRanges, type GFMEmailSourceRange, type MarkdownSourceNode } from "@/utils/gfm-email";
import { findMarkdownGFMURLRanges } from "@/utils/gfm-url";
import { hasExactMarkdownRange, resolvedMarkdownLinkRanges } from "@/utils/markdown-link";
import { decodedMarkdownCharacterReferenceAt, findDecodedMarkdownSourceBoundaries } from "@/utils/markdown-source-boundaries";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";
import { findMentionMatches } from "@/utils/mention-grammar";
import { findTagMatches } from "@/utils/tag-grammar";
import { isUsernameCharacter } from "@/utils/username";

type Segment =
  | { type: "text"; value: string }
  | { type: "tag"; source: string; value: string }
  | { type: "mention"; source: string; value: string };

interface SourceRange {
  from: number;
  to: number;
  type: "Entity" | "Escape" | "LineEnding" | "Opaque";
}

interface MarkdownSourceContext {
  boundaries: SourceRange[];
  emailRanges: GFMEmailSourceRange[];
  emphasisRanges: Array<{ from: number; to: number; delimiterWidth: 1 | 2 }>;
  linkRanges: Array<{ from: number; to: number }>;
  syntaxLinkRanges: Array<{ from: number; to: number }>;
}

interface LiteralRun {
  source: string;
  sourceFrom: number;
  valueFrom: number;
}

interface SourceSpan {
  from: number;
  to: number;
}

const sourceParser = markdownParser.configure(memoMarkdownExtensions);
const TRANSPARENT_PARENT_TYPES = new Set([
  "blockquote",
  "delete",
  "emphasis",
  "heading",
  "list",
  "listItem",
  "paragraph",
  "root",
  "strong",
  "table",
  "tableCell",
  "tableRow",
]);

function distinctRanges<T extends SourceSpan>(values: T[], discriminator: (value: T) => string = () => ""): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.from}:${value.to}:${discriminator(value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function markdownSourceContext(source: string): MarkdownSourceContext {
  const ranges: SourceRange[] = [];
  const emphasisRanges: Array<{ from: number; to: number; delimiterWidth: 1 | 2 }> = [];
  const linkRanges: Array<{ from: number; to: number }> = [];
  const syntaxLinkRanges: Array<{ from: number; to: number }> = [];
  const tree = sourceParser.parse(source);
  const sourceRoot = tree.topNode as MarkdownSourceNode;
  const resolvedLinks = resolvedMarkdownLinkRanges(source, sourceRoot);
  const emailRanges = findMarkdownGFMEmailRanges(source, sourceRoot, resolvedLinks, true);
  // Micromark has already consumed the one permitted document BOM before the
  // source reaches this reconciler, so a remaining BOM is ordinary text.
  const writtenURLRanges = findMarkdownGFMURLRanges(source, sourceRoot, resolvedLinks, false);
  linkRanges.push(...writtenURLRanges);
  ranges.push(...writtenURLRanges.map((range) => ({ ...range, type: "Opaque" as const })));
  const decodedBoundaries = findDecodedMarkdownSourceBoundaries(source);
  tree.iterate({
    enter(node) {
      if (node.name === "Escape" || node.name === "Entity") {
        ranges.push({ from: node.from, to: node.to, type: node.name });
        return false;
      }
      if (node.name === "InlineMath" || node.name === "BlockMath") {
        ranges.push({ from: node.from, to: node.to, type: "Opaque" });
        return false;
      }
      if (node.name === "InlineCode") {
        ranges.push({ from: node.from, to: node.to, type: "Opaque" });
        return false;
      }
      if (node.name === "EmphasisMark") {
        ranges.push({ from: node.from, to: node.to, type: "Opaque" });
        return false;
      }
      if (node.name === "Emphasis" || node.name === "StrongEmphasis") {
        emphasisRanges.push({ from: node.from, to: node.to, delimiterWidth: node.name === "StrongEmphasis" ? 2 : 1 });
      }
      if (node.name === "Link" || node.name === "Image" || node.name === "Autolink") {
        if (node.name !== "Autolink" && !hasExactMarkdownRange(resolvedLinks, node.node as MarkdownSourceNode)) return;
        linkRanges.push({ from: node.from, to: node.to });
        syntaxLinkRanges.push({ from: node.from, to: node.to });
        ranges.push({ from: node.from, to: node.to, type: "Opaque" });
        return false;
      }
    },
  });
  ranges.push(
    ...decodedBoundaries.filter(
      (boundary) => !ranges.some((range) => range.type === "Opaque" && range.from <= boundary.from && range.to >= boundary.to),
    ),
  );

  const projectUnresolvedSecondLabels = (node: MarkdownSourceNode): void => {
    const unresolvedLinkLike = (node.name === "Link" || node.name === "Image") && !hasExactMarkdownRange(resolvedLinks, node);
    if (unresolvedLinkLike) {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.name !== "LinkLabel" || child.to - child.from <= 2) continue;

        const contentFrom = child.from + 1;
        const contentTo = child.to - 1;
        const prefix = "x ";
        const nested = markdownSourceContext(prefix + source.slice(contentFrom, contentTo));
        const offset = contentFrom - prefix.length;
        const project = <T extends { from: number; to: number }>(ranges: T[]): T[] =>
          ranges
            .filter((range) => range.from >= prefix.length && range.to <= prefix.length + contentTo - contentFrom)
            .map((range) => ({ ...range, from: range.from + offset, to: range.to + offset }));

        const excludedSyntheticBoundaryURLs = nested.linkRanges.filter(
          (range) =>
            range.from === prefix.length &&
            !nested.syntaxLinkRanges.some((syntaxRange) => syntaxRange.from === range.from && syntaxRange.to === range.to),
        );
        const isExcludedSyntheticBoundaryURL = (range: { from: number; to: number }) =>
          excludedSyntheticBoundaryURLs.some((excluded) => excluded.from === range.from && excluded.to === range.to);

        ranges.push(...project(nested.boundaries.filter((range) => !isExcludedSyntheticBoundaryURL(range))));
        emphasisRanges.push(...project(nested.emphasisRanges));
        linkRanges.push(...project(nested.linkRanges.filter((range) => !isExcludedSyntheticBoundaryURL(range))));
        syntaxLinkRanges.push(...project(nested.syntaxLinkRanges));
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) projectUnresolvedSecondLabels(child);
  };
  projectUnresolvedSecondLabels(sourceRoot);

  const projectRejectedURLNodes = (parent: MarkdownSourceNode): void => {
    if (
      parent.name === "Autolink" ||
      parent.name === "LinkReference" ||
      ((parent.name === "Link" || parent.name === "Image") && hasExactMarkdownRange(resolvedLinks, parent))
    ) {
      return;
    }
    for (let node = parent.firstChild; node; node = node.nextSibling) {
      if (node.name !== "URL") {
        projectRejectedURLNodes(node);
        continue;
      }

      const coveredByCanonicalURL = writtenURLRanges.some((range) => range.from <= node.from && range.to >= node.to);
      const coveredByEmail = emailRanges.some((range) => range.from <= node.from && range.to >= node.to);
      if (!coveredByCanonicalURL && !coveredByEmail) {
        const prefix = "x";
        const nestedSource = prefix + source.slice(node.from, node.to);
        const nested = markdownSourceContext(nestedSource);
        const offset = node.from - prefix.length;
        const project = <T extends { from: number; to: number }>(values: T[]): T[] =>
          values
            .filter((range) => range.from >= prefix.length && range.to <= nestedSource.length)
            .map((range) => ({ ...range, from: range.from + offset, to: range.to + offset }));

        ranges.push(...project(nested.boundaries));
        emailRanges.push(...project(nested.emailRanges));
        emphasisRanges.push(...project(nested.emphasisRanges));
        linkRanges.push(...project(nested.linkRanges));
        syntaxLinkRanges.push(...project(nested.syntaxLinkRanges));

        if (source.slice(node.from, node.to).includes("_") && source.slice(parent.from, node.from).includes("_")) {
          const insertion = node.from - parent.from;
          const contextualSource = source.slice(parent.from, node.from) + prefix + source.slice(node.from, node.to);
          const contentFrom = insertion + prefix.length;
          sourceParser.parse(contextualSource).iterate({
            enter(mark) {
              if (mark.name === "EmphasisMark" && mark.from >= contentFrom) {
                ranges.push({
                  from: mark.from + parent.from - prefix.length,
                  to: mark.to + parent.from - prefix.length,
                  type: "Opaque",
                });
              }
            },
          });
        }
      }
    }
  };
  projectRejectedURLNodes(sourceRoot);

  for (const match of source.matchAll(/\r\n?|\n/g)) {
    const lineEndingTo = match.index + match[0].length;
    if (!ranges.some((range) => range.type === "Opaque" && range.from < lineEndingTo && range.to > match.index)) {
      ranges.push({ from: match.index, to: lineEndingTo, type: "LineEnding" });
    }
  }
  return {
    boundaries: distinctRanges(ranges, (range) => range.type).sort((left, right) => left.from - right.from || left.to - right.to),
    emailRanges: distinctRanges(emailRanges, (range) => range.value),
    emphasisRanges: distinctRanges(emphasisRanges, (range) => String(range.delimiterWidth)).sort(
      (left, right) => left.to - left.from - (right.to - right.from) || left.from - right.from,
    ),
    linkRanges: distinctRanges(linkRanges).sort((left, right) => left.from - right.from || left.to - right.to),
    syntaxLinkRanges: distinctRanges(syntaxLinkRanges).sort((left, right) => left.from - right.from || left.to - right.to),
  };
}

/**
 * Map original-source literal runs to the decoded mdast text value. Markdown
 * escapes and character references are omitted from the runs and therefore
 * remain hard lexer boundaries.
 */
function literalRunsForTextNode(
  value: string,
  span: SourceSpan | undefined,
  source: string,
  boundaries: SourceRange[],
): LiteralRun[] | undefined {
  if (!span) return undefined;
  const { from: start, to: end } = span;

  const runs: LiteralRun[] = [];
  let sourceCursor = start;
  let valueCursor = 0;
  let maySkipContainerPrefix = false;

  const decodeBoundary = (spelling: string, type: SourceRange["type"]): string => {
    if (type !== "LineEnding") return decodeString(spelling).replaceAll("\0", "�");
    return /^(?:\r\n?|\n)/.test(spelling) ? "\n" : "";
  };

  const addRun = (runEnd: number, mayOmitTrailingWhitespace = false): boolean => {
    let runStart = sourceCursor;
    let runSource = source.slice(runStart, runEnd);
    if (!runSource) return true;

    let decodedRun = runSource.replaceAll("\0", "�");
    if (!value.startsWith(decodedRun, valueCursor)) {
      if (mayOmitTrailingWhitespace) {
        let trimmedEnd = runEnd;
        while (trimmedEnd > runStart && (source[trimmedEnd - 1] === " " || source[trimmedEnd - 1] === "\t")) trimmedEnd--;
        runSource = source.slice(runStart, trimmedEnd);
        decodedRun = runSource.replaceAll("\0", "�");
        if (value.startsWith(decodedRun, valueCursor)) {
          if (runSource) runs.push({ source: runSource, sourceFrom: runStart, valueFrom: valueCursor });
          valueCursor += decodedRun.length;
          maySkipContainerPrefix = false;
          return true;
        }
      }
      if (!maySkipContainerPrefix) return false;
      let aligned = false;
      while (runStart < runEnd && (source[runStart] === " " || source[runStart] === "\t" || source[runStart] === ">")) {
        runStart++;
        runSource = source.slice(runStart, runEnd);
        decodedRun = runSource.replaceAll("\0", "�");
        if (value.startsWith(decodedRun, valueCursor)) {
          aligned = true;
          break;
        }
      }
      if (!aligned) return false;
    }

    if (runSource) runs.push({ source: runSource, sourceFrom: runStart, valueFrom: valueCursor });
    valueCursor += decodedRun.length;
    maySkipContainerPrefix = false;
    return true;
  };

  for (const boundary of boundaries) {
    const boundaryFrom = Math.max(boundary.from, start);
    const boundaryTo = Math.min(boundary.to, end);
    if (boundaryFrom >= boundaryTo) continue;

    const fullBoundarySource = source.slice(boundary.from, boundary.to);
    const fullDecodedBoundary = decodeBoundary(fullBoundarySource, boundary.type);
    if (boundary.type === "Entity" && fullDecodedBoundary === fullBoundarySource) {
      // Lezer recognizes the shape of unknown named references. Micromark
      // leaves those names literal, so they are not syntax boundaries.
      continue;
    }

    const boundarySource = source.slice(boundaryFrom, boundaryTo);
    const decodedBoundary = decodeBoundary(boundarySource, boundary.type);

    if (!addRun(boundaryFrom, boundary.type === "LineEnding")) return undefined;
    sourceCursor = boundaryTo;
    if (boundary.type === "LineEnding") {
      const rawLineEnding = boundarySource.match(/^(?:\r\n?|\n)/)?.[0] ?? "";
      if (rawLineEnding && value.startsWith(rawLineEnding, valueCursor)) {
        valueCursor += rawLineEnding.length;
      } else if (rawLineEnding && value.startsWith("\n", valueCursor)) {
        valueCursor++;
      } else if (rawLineEnding) {
        return undefined;
      }
      maySkipContainerPrefix = true;
      continue;
    }
    // remark-gfm sometimes preserves escape/entity source inside a permissive
    // literal link. Prefer that complete raw spelling: a decoded entity such
    // as `&` can otherwise be a misleading prefix of `&amp;`.
    const rawBoundary = boundarySource.replaceAll("\0", "�");
    if (value.startsWith(rawBoundary, valueCursor)) {
      valueCursor += rawBoundary.length;
    } else {
      if (!value.startsWith(decodedBoundary, valueCursor)) return undefined;
      valueCursor += decodedBoundary.length;
    }
  }

  if (!addRun(end)) return undefined;
  return runs;
}

function segmentsForTextNode(
  value: string,
  span: SourceSpan | undefined,
  source: string,
  boundaries: SourceRange[],
): Segment[] | undefined {
  const runs = literalRunsForTextNode(value, span, source, boundaries);
  if (!runs) return undefined;

  const matches = runs
    .flatMap((run) => [
      ...findTagMatches(run.source).map((match) => ({
        type: "tag" as const,
        from: run.valueFrom + match.from,
        to: run.valueFrom + match.to,
        source: run.source.slice(match.from, match.to),
        value: match.value,
      })),
      ...findMentionMatches(run.source, run.sourceFrom === 0 || !isUsernameCharacter(source[run.sourceFrom - 1])).map((match) => ({
        type: "mention" as const,
        from: run.valueFrom + match.from,
        to: run.valueFrom + match.to,
        source: run.source.slice(match.from, match.to),
        value: match.username,
      })),
    ])
    .sort((left, right) => left.from - right.from || left.to - right.to);
  if (matches.length === 0) return [{ type: "text", value }];

  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.from < cursor) continue;
    if (cursor < match.from) segments.push({ type: "text", value: value.slice(cursor, match.from) });
    segments.push({ type: match.type, source: match.source, value: match.value });
    cursor = match.to;
  }
  if (cursor < value.length) segments.push({ type: "text", value: value.slice(cursor) });
  return segments;
}

function createTagNode(tagValue: string, source: string): TagNode {
  const data: TagNodeData = {
    hName: "span",
    hProperties: {
      className: "tag",
      "data-tag": tagValue,
    },
    hChildren: [{ type: "text", value: source }],
  };

  return {
    type: "tagNode",
    value: tagValue,
    data,
  } as TagNode;
}

function createMentionNode(username: string, source: string): MentionNode {
  const data: MentionNodeData = {
    hName: "span",
    hProperties: {
      className: "mention",
      "data-mention": username,
    },
    hChildren: [{ type: "text", value: source }],
  };

  return {
    type: "mentionNode",
    value: username,
    data,
  } as MentionNode;
}

type ParentNode = UnistNode & { children: UnistNode[] };

function isParentNode(node: UnistNode): node is ParentNode {
  return Array.isArray((node as { children?: unknown }).children);
}

function positionedSpan(node: UnistNode): SourceSpan | undefined {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  return from === undefined || to === undefined ? undefined : { from, to };
}

function nodeSpan(node: UnistNode, recoveredSpans: WeakMap<UnistNode, SourceSpan>): SourceSpan | undefined {
  return positionedSpan(node) ?? recoveredSpans.get(node);
}

function isCoveredBySourceRange(
  node: UnistNode,
  ranges: Array<{ from: number; to: number }>,
  recoveredSpans: WeakMap<UnistNode, SourceSpan>,
): boolean {
  const span = nodeSpan(node, recoveredSpans);
  return !!span && ranges.some((range) => range.from <= span.from && range.to >= span.to);
}

function isWrittenGFMLink(node: ParentNode, context: MarkdownSourceContext, recoveredSpans: WeakMap<UnistNode, SourceSpan>): boolean {
  return isCoveredBySourceRange(node, context.linkRanges, recoveredSpans);
}

function isLiteralEmailLink(node: UnistNode, context: MarkdownSourceContext, recoveredSpans: WeakMap<UnistNode, SourceSpan>): boolean {
  return (
    node.type === "link" &&
    (node as Link).url.startsWith("mailto:") &&
    !isCoveredBySourceRange(node, context.syntaxLinkRanges, recoveredSpans)
  );
}

function decodedMarkdownText(source: string): string {
  return decodeString(source).replaceAll("\0", "�");
}

function mergeAdjacentTextNodes(parent: ParentNode, source: string, recoveredSpans: WeakMap<UnistNode, SourceSpan>): void {
  for (let index = 0; index + 1 < parent.children.length; ) {
    const left = parent.children[index];
    const right = parent.children[index + 1];
    if (left.type !== "text" || right.type !== "text") {
      index++;
      continue;
    }

    const leftSpan = nodeSpan(left, recoveredSpans);
    const rightSpan = nodeSpan(right, recoveredSpans);
    if (!leftSpan || !rightSpan || leftSpan.to !== rightSpan.from) {
      index++;
      continue;
    }

    const mergedSpan = { from: leftSpan.from, to: rightSpan.to };
    const merged = { type: "text", value: decodedMarkdownText(source.slice(mergedSpan.from, mergedSpan.to)) } as Text;
    recoveredSpans.set(merged, mergedSpan);
    parent.children.splice(index, 2, merged);
  }
}

function decodedSourceProjection(source: string, from: number, to: number): { value: string; starts: number[]; ends: number[] } {
  let value = "";
  const starts: number[] = [];
  const ends: number[] = [];

  const append = (raw: string, decoded: string, tokenFrom: number, tokenTo: number) => {
    const normalized = decoded.replaceAll("\0", "�");
    value += normalized;
    for (let index = 0; index < normalized.length; index++) {
      starts.push(raw.length === normalized.length ? tokenFrom + index : tokenFrom);
      ends.push(raw.length === normalized.length ? tokenFrom + index + 1 : tokenTo);
    }
  };

  for (let cursor = from; cursor < to; ) {
    if (source[cursor] === "\\" && cursor + 1 < to) {
      const raw = source.slice(cursor, cursor + 2);
      const decoded = decodeString(raw);
      if (decoded !== raw) {
        append(raw, decoded, cursor, cursor + 2);
        cursor += 2;
        continue;
      }
    }

    const reference = decodedMarkdownCharacterReferenceAt(source, cursor, to);
    if (reference) {
      append(source.slice(cursor, reference.to), reference.value, cursor, reference.to);
      cursor = reference.to;
      continue;
    }

    const codePoint = source.codePointAt(cursor);
    const size = codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    const raw = source.slice(cursor, Math.min(to, cursor + size));
    append(raw, raw, cursor, cursor + raw.length);
    cursor += raw.length;
  }

  return { value, starts, ends };
}

function recoverTextSpans(
  parent: ParentNode,
  source: string,
  context: MarkdownSourceContext,
  recoveredSpans: WeakMap<UnistNode, SourceSpan>,
): void {
  const parentSpan = nodeSpan(parent, recoveredSpans);
  if (!parentSpan) return;

  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];
    if (child.type !== "text" || nodeSpan(child, recoveredSpans)) continue;

    const textNode = child as Text;
    let lowerBound = parentSpan.from;
    for (let previous = index - 1; previous >= 0; previous--) {
      const span = nodeSpan(parent.children[previous], recoveredSpans);
      if (span) {
        lowerBound = span.to;
        break;
      }
    }
    let upperBound = parentSpan.to;
    for (let next = index + 1; next < parent.children.length; next++) {
      const span = nodeSpan(parent.children[next], recoveredSpans);
      if (span) {
        upperBound = span.from;
        break;
      }
    }

    // Positionless nodes are a remark-gfm recovery artifact. Locate their
    // decoded value monotonically inside the surrounding structural source;
    // Markdown delimiters remain in the projection and therefore outside the
    // recovered span.
    const projection = decodedSourceProjection(source, lowerBound, upperBound);
    for (let indexInProjection = projection.value.indexOf(textNode.value); indexInProjection >= 0; ) {
      const lastIndex = indexInProjection + textNode.value.length - 1;
      const span = {
        from: projection.starts[indexInProjection] ?? lowerBound,
        to: projection.ends[lastIndex] ?? projection.starts[indexInProjection] ?? lowerBound,
      };
      if (literalRunsForTextNode(textNode.value, span, source, context.boundaries)) {
        recoveredSpans.set(child, span);
        break;
      }
      indexInProjection = projection.value.indexOf(textNode.value, indexInProjection + 1);
    }
  }
}

function synthesizeGFMEmailLinks(
  parent: ParentNode,
  source: string,
  context: MarkdownSourceContext,
  recoveredSpans: WeakMap<UnistNode, SourceSpan>,
): void {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];
    if (child.type !== "text") continue;

    const span = nodeSpan(child, recoveredSpans);
    if (!span) continue;
    const emailRanges = context.emailRanges.filter((range) => span.from <= range.from && span.to >= range.to);
    if (emailRanges.length === 0) continue;

    const replacement: UnistNode[] = [];
    let cursor = span.from;
    for (const range of emailRanges) {
      if (cursor < range.from) {
        const text = { type: "text", value: decodedMarkdownText(source.slice(cursor, range.from)) } as Text;
        recoveredSpans.set(text, { from: cursor, to: range.from });
        replacement.push(text);
      }

      const value = range.value;
      const text = { type: "text", value } as Text;
      const link = { type: "link", title: null, url: `mailto:${value}`, children: [text] } as Link;
      recoveredSpans.set(text, range);
      recoveredSpans.set(link, range);
      replacement.push(link as UnistNode);
      cursor = range.to;
    }
    if (cursor < span.to) {
      const text = { type: "text", value: decodedMarkdownText(source.slice(cursor, span.to)) } as Text;
      recoveredSpans.set(text, { from: cursor, to: span.to });
      replacement.push(text);
    }

    parent.children.splice(index, 1, ...replacement);
    index += replacement.length - 1;
  }
}

function reconcileUnderscoreEmailEmphasis(
  parent: ParentNode,
  source: string,
  context: MarkdownSourceContext,
  recoveredSpans: WeakMap<UnistNode, SourceSpan>,
): void {
  for (const range of context.emphasisRanges) {
    const delimiter = "_".repeat(range.delimiterWidth);
    if (
      source.slice(range.from, range.from + range.delimiterWidth) !== delimiter ||
      source.slice(range.to - range.delimiterWidth, range.to) !== delimiter
    ) {
      continue;
    }
    const innerFrom = range.from + range.delimiterWidth;
    const innerTo = range.to - range.delimiterWidth;
    if (
      !context.emailRanges.some(
        (emailRange) =>
          emailRange.from >= innerFrom &&
          emailRange.to <= innerTo &&
          [...source.slice(innerFrom, emailRange.from)].every((character) => character === "_"),
      )
    ) {
      continue;
    }

    const firstIndex = parent.children.findIndex((child) => {
      const span = nodeSpan(child, recoveredSpans);
      return !!span && span.from <= range.from && span.to >= innerFrom;
    });
    if (firstIndex < 0) continue;
    const lastIndex = parent.children.findIndex((child, index) => {
      const span = nodeSpan(child, recoveredSpans);
      return index >= firstIndex && !!span && span.from <= innerTo && span.to >= range.to;
    });
    if (lastIndex <= firstIndex) continue;

    const first = parent.children[firstIndex];
    const last = parent.children[lastIndex];
    const firstSpan = nodeSpan(first, recoveredSpans);
    const lastSpan = nodeSpan(last, recoveredSpans);
    if (first.type !== "text" || last.type !== "text" || !firstSpan || !lastSpan) continue;

    const textNode = (from: number, to: number): Text => {
      const text = { type: "text", value: decodedMarkdownText(source.slice(from, to)) } as Text;
      recoveredSpans.set(text, { from, to });
      return text;
    };
    const emphasisChildren: UnistNode[] = [];
    if (innerFrom < firstSpan.to) emphasisChildren.push(textNode(innerFrom, Math.min(firstSpan.to, innerTo)));
    emphasisChildren.push(...parent.children.slice(firstIndex + 1, lastIndex));
    if (lastSpan.from < innerTo) emphasisChildren.push(textNode(Math.max(lastSpan.from, innerFrom), innerTo));

    const emphasis = { type: range.delimiterWidth === 2 ? "strong" : "emphasis", children: emphasisChildren } as ParentNode;
    recoveredSpans.set(emphasis, range);
    const replacement: UnistNode[] = [];
    if (firstSpan.from < range.from) replacement.push(textNode(firstSpan.from, range.from));
    replacement.push(emphasis);
    if (range.to < lastSpan.to) replacement.push(textNode(range.to, lastSpan.to));
    parent.children.splice(firstIndex, lastIndex - firstIndex + 1, ...replacement);
  }
}

/**
 * remark-gfm accepts links beyond written GFM and can split or de-position the
 * surrounding text. Reconcile that drift before scanning so original source
 * ranges, rather than incidental mdast child boundaries, define literal runs.
 */
function reconcileTextNodes(
  parent: ParentNode,
  source: string,
  context: MarkdownSourceContext,
  recoveredSpans: WeakMap<UnistNode, SourceSpan>,
): void {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];

    if (isParentNode(child) && TRANSPARENT_PARENT_TYPES.has(child.type)) {
      reconcileTextNodes(child, source, context, recoveredSpans);
    } else if (
      child.type === "link" &&
      isParentNode(child) &&
      (isLiteralEmailLink(child, context, recoveredSpans) || !isWrittenGFMLink(child, context, recoveredSpans))
    ) {
      // Rebuild literal emails from canonical source ranges, and unwrap only
      // remark-gfm's broader URL forms. Written GFM URL links stay opaque.
      const span = nodeSpan(child, recoveredSpans);
      if (span) {
        const textNode = { type: "text", value: decodedMarkdownText(source.slice(span.from, span.to)) } as Text;
        recoveredSpans.set(textNode, span);
        parent.children.splice(index, 1, textNode);
      } else {
        parent.children.splice(index, 1, ...child.children);
      }
      index--;
    }
  }

  mergeAdjacentTextNodes(parent, source, recoveredSpans);
  recoverTextSpans(parent, source, context, recoveredSpans);
  mergeAdjacentTextNodes(parent, source, recoveredSpans);
  synthesizeGFMEmailLinks(parent, source, context, recoveredSpans);
  reconcileUnderscoreEmailEmphasis(parent, source, context, recoveredSpans);
}

function transformMemoTextNodes(
  parent: ParentNode,
  source: string,
  context: MarkdownSourceContext,
  recoveredSpans: WeakMap<UnistNode, SourceSpan>,
): void {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];

    if (child.type === "text") {
      const textNode = child as Text;
      const segments = segmentsForTextNode(textNode.value, nodeSpan(textNode, recoveredSpans), source, context.boundaries);
      if (!segments || segments.every((segment) => segment.type === "text")) continue;

      const newNodes = segments.map((segment) => {
        if (segment.type === "tag") return createTagNode(segment.value, segment.source);
        if (segment.type === "mention") return createMentionNode(segment.value, segment.source);
        return { type: "text", value: segment.value } as Text;
      });
      parent.children.splice(index, 1, ...(newNodes as UnistNode[]));
      index += newNodes.length - 1;
      continue;
    }

    if (isParentNode(child) && TRANSPARENT_PARENT_TYPES.has(child.type)) {
      transformMemoTextNodes(child, source, context, recoveredSpans);
    }
  }
}

type VFileLike = { value?: string | Uint8Array };

function transformMemoSyntax(tree: Root, rawSource: string): void {
  const source = rawSource.startsWith("\uFEFF") ? rawSource.slice(1) : rawSource;
  const context = markdownSourceContext(source);
  const recoveredSpans = new WeakMap<UnistNode, SourceSpan>();
  reconcileTextNodes(tree as ParentNode, source, context, recoveredSpans);
  transformMemoTextNodes(tree as ParentNode, source, context, recoveredSpans);
}

/** Transform Memos inline source syntaxes after GFM and math parsing. */
export const remarkMemoSyntax = () => {
  return (tree: Root, file: VFileLike) => {
    transformMemoSyntax(tree, typeof file.value === "string" ? file.value : "");
  };
};

/** Extract exact mention candidates with the same Markdown rules used for rendering. */
export function extractMentionUsernames(source: string): string[] {
  const tree = fromMarkdown(source, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  transformMemoSyntax(tree, source);

  const usernames: string[] = [];
  const collect = (node: UnistNode): void => {
    if (node.type === "mentionNode") usernames.push((node as MentionNode).value);
    if (isParentNode(node)) node.children.forEach(collect);
  };
  collect(tree);
  return Array.from(new Set(usernames));
}
