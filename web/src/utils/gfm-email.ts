import { parser as markdownParser } from "@lezer/markdown";
import { decodeString } from "micromark-util-decode-string";
import { isValidMarkdownLinkReference, resolvedMarkdownLinkRanges } from "@/utils/markdown-link";
import { decodedMarkdownCharacterReferenceAt } from "@/utils/markdown-source-boundaries";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

export interface GFMEmailSourceRange {
  from: number;
  to: number;
  value: string;
}

export interface MarkdownSourceNode {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly firstChild: MarkdownSourceNode | null;
  readonly nextSibling: MarkdownSourceNode | null;
}

interface MarkdownSourceRange {
  from: number;
  to: number;
}

const DOMAIN_AT_START = /^@(?:[A-Za-z0-9_-]+\.)+[A-Za-z0-9_-]*[A-Za-z0-9]/;
const REFERENCE_LABEL_PREFIX = "x ";
const sourceParser = markdownParser.configure(memoMarkdownExtensions);

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

function isLocalChar(char: string): boolean {
  return /[A-Za-z0-9._+-]/.test(char);
}

function isASCIIPunctuation(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x21 && code <= 0x2f) || (code >= 0x3a && code <= 0x40) || (code >= 0x5b && code <= 0x60) || (code >= 0x7b && code <= 0x7e)
  );
}

interface EmailProjection {
  value: string;
  starts: number[];
  ends: number[];
}

function projectEmailText(source: string, lowerBound: number, upperBound: number): EmailProjection {
  let value = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (let cursor = lowerBound; cursor < upperBound; ) {
    if (source[cursor] === "\\" && cursor + 1 < upperBound && isASCIIPunctuation(source[cursor + 1])) {
      value += source[cursor + 1];
      starts.push(cursor);
      ends.push(cursor + 2);
      cursor += 2;
      continue;
    }

    const reference = decodedMarkdownCharacterReferenceAt(source, cursor, upperBound);
    if (reference) {
      value += reference.value;
      for (let index = 0; index < reference.value.length; index++) {
        starts.push(cursor);
        ends.push(reference.to);
      }
      cursor = reference.to;
      continue;
    }

    const codePoint = source.codePointAt(cursor);
    const character = codePoint === undefined ? "" : String.fromCodePoint(codePoint);
    value += character;
    for (let index = 0; index < character.length; index++) {
      starts.push(cursor);
      ends.push(cursor + character.length);
    }
    cursor += character.length;
  }
  return { value, starts, ends };
}

function matchEmailAt(source: string, at: number, lowerBound: number, upperBound: number): GFMEmailSourceRange | undefined {
  let start = at;
  while (start > lowerBound) {
    if (!isLocalChar(source[start - 1])) break;
    start--;
  }
  if (start === at) return undefined;

  const domain = source.slice(at, upperBound).match(DOMAIN_AT_START)?.[0];
  if (!domain) return undefined;
  const end = at + domain.length;
  if (end < upperBound && (source[end] === "-" || source[end] === "_")) return undefined;
  return { from: start, to: end, value: source.slice(start, end) };
}

/** Find extended GFM email autolinks inside one parsed text-source run. */
export function findGFMEmailMatches(source: string, lowerBound = 0, upperBound = source.length): GFMEmailSourceRange[] {
  const projection = projectEmailText(source, lowerBound, upperBound);
  const matches: GFMEmailSourceRange[] = [];
  for (let cursor = 0; cursor < projection.value.length; ) {
    const at = projection.value.indexOf("@", cursor);
    if (at < 0) break;
    const match = matchEmailAt(projection.value, at, cursor, projection.value.length);
    if (!match) {
      cursor = at + 1;
      continue;
    }
    matches.push({
      from: projection.starts[match.from],
      to: projection.ends[match.to - 1],
      value: match.value,
    });
    cursor = match.to;
  }
  return matches;
}

/** Whether a Lezer URL node is an email candidate rather than a written URL. */
export function isGFMEmailURLSource(source: string): boolean {
  return source.includes("@") && !/^(?:https?:\/\/|www\.)/.test(source);
}

/**
 * Find canonical GFM email ranges within Lezer textual containers. Email URL
 * nodes and backslash escapes stay in the same text run so parser splits
 * cannot shorten the decoded GFM 0.29 match; links, code, math, and other
 * syntax remain opaque.
 */
export function findMarkdownGFMEmailRanges(
  source: string,
  root: MarkdownSourceNode,
  resolvedLinks: MarkdownSourceRange[],
  allowUnresolvedLinks: boolean,
): GFMEmailSourceRange[] {
  const ranges: GFMEmailSourceRange[] = [];

  const collectUnresolvedReferenceLabel = (node: MarkdownSourceNode): void => {
    const contentFrom = node.from + 1;
    const contentTo = node.to - 1;
    if (contentFrom >= contentTo) return;

    const prefixedSource = REFERENCE_LABEL_PREFIX + source.slice(contentFrom, contentTo);
    const root = sourceParser.parse(prefixedSource).topNode as MarkdownSourceNode;
    const offset = contentFrom - REFERENCE_LABEL_PREFIX.length;
    for (const range of findMarkdownGFMEmailRanges(prefixedSource, root, resolvedMarkdownLinkRanges(prefixedSource, root), true)) {
      const from = range.from + offset;
      const to = range.to + offset;
      if (from >= contentFrom && to <= contentTo) ranges.push({ from, to, value: range.value });
    }
  };

  const collect = (node: MarkdownSourceNode) => {
    const linkLike = node.name === "Link" || node.name === "Image";
    const resolvedLink = linkLike && resolvedLinks.some((range) => range.from === node.from && range.to === node.to);
    if (resolvedLink || (linkLike && !allowUnresolvedLinks)) return;

    const invalidLinkReference = node.name === "LinkReference" && !isValidMarkdownLinkReference(source, node);
    const scansDirectText = TEXT_CONTAINERS.has(node.name) || linkLike || invalidLinkReference;
    if (!scansDirectText && !STRUCTURAL_CONTAINERS.has(node.name)) return;

    let cursor = node.from;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      const spelling = source.slice(child.from, child.to);
      const staysInTextRun =
        scansDirectText &&
        (child.name === "Escape" ||
          (child.name === "Entity" && decodeString(spelling) !== spelling) ||
          (child.name === "URL" && isGFMEmailURLSource(spelling)));
      if (staysInTextRun) continue;

      if (scansDirectText && cursor < child.from) ranges.push(...findGFMEmailMatches(source, cursor, child.from));
      if ((linkLike || invalidLinkReference) && child.name === "LinkLabel") {
        collectUnresolvedReferenceLabel(child);
      } else {
        collect(child);
      }
      cursor = child.to;
    }
    if (scansDirectText && cursor < node.to) ranges.push(...findGFMEmailMatches(source, cursor, node.to));
  };

  collect(root);
  return ranges.sort((left, right) => left.from - right.from || left.to - right.to);
}
