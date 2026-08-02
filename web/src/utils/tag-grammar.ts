import { COMBINING_MARK_RANGES, DEFAULT_IGNORABLE_RANGES, FULLY_QUALIFIED_EMOJI, XID_CONTINUE_RANGES } from "@/utils/tag-unicode-data";

/** A recognized `#tag` source span and the identifier emitted from it. */
export interface TagMatch {
  /** UTF-16 offsets into the scanned source, including the `#` introducer. */
  from: number;
  to: number;
  /** Exact source spelling after the introducer, including ignored code points. */
  source: string;
  /** Emitted tag identifier, excluding the introducer and ignored code points. */
  value: string;
}

interface EmojiTrieNode {
  children: Map<number, EmojiTrieNode>;
  terminal: boolean;
}

const emojiTrie: EmojiTrieNode = { children: new Map(), terminal: false };
for (const emoji of FULLY_QUALIFIED_EMOJI) {
  let node = emojiTrie;
  for (const codePoint of emoji) {
    const value = codePoint.codePointAt(0) ?? 0;
    let child = node.children.get(value);
    if (!child) {
      child = { children: new Map(), terminal: false };
      node.children.set(value, child);
    }
    node = child;
  }
  node.terminal = true;
}

function codePointAt(source: string, index: number): string {
  const value = source.codePointAt(index);
  return value === undefined ? "" : String.fromCodePoint(value);
}

function isInRanges(codePoint: number, ranges: readonly number[]): boolean {
  let low = 0;
  let high = ranges.length / 2 - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const from = ranges[middle * 2];
    const to = ranges[middle * 2 + 1];
    if (codePoint < from) high = middle - 1;
    else if (codePoint > to) low = middle + 1;
    else return true;
  }
  return false;
}

/** Match the longest fully-qualified Emoji 17 sequence at a UTF-16 offset. */
function emojiAt(source: string, index: number, limit: number): string | undefined {
  let node = emojiTrie;
  let cursor = index;
  let longestEnd = -1;
  while (cursor < limit) {
    const codePoint = source.codePointAt(cursor);
    if (codePoint === undefined) break;
    const child = node.children.get(codePoint);
    if (!child) break;
    cursor += codePoint > 0xffff ? 2 : 1;
    if (cursor > limit) break;
    node = child;
    if (node.terminal) longestEnd = cursor;
  }
  return longestEnd < 0 ? undefined : source.slice(index, longestEnd);
}

/** Whether the `#` at a UTF-16 offset is an introducer rather than emoji. */
export function isTagIntroducerAt(source: string, index: number, limit = source.length): boolean {
  return index >= 0 && index < limit && source[index] === "#" && !emojiAt(source, index, limit);
}

function isDefaultIgnorable(value: string): boolean {
  return isInRanges(value.codePointAt(0) ?? 0, DEFAULT_IGNORABLE_RANGES);
}

function isXIDContinue(value: string): boolean {
  return isInRanges(value.codePointAt(0) ?? 0, XID_CONTINUE_RANGES) && !isDefaultIgnorable(value);
}

function isCombiningMark(value: string): boolean {
  return isInRanges(value.codePointAt(0) ?? 0, COMBINING_MARK_RANGES);
}

function isExtensionUnit(value: string): boolean {
  return value === "-" || value === "+" || value === "&";
}

function isApostropheJoiner(value: string): boolean {
  return value === "'" || value === "’";
}

function isNonCombiningXIDContinuationAt(source: string, index: number, limit: number): boolean {
  if (index >= limit || emojiAt(source, index, limit)) return false;
  const value = codePointAt(source, index);
  return index + value.length <= limit && isXIDContinue(value) && !isCombiningMark(value);
}

interface SegmentMatch {
  to: number;
  value: string;
}

function scanSegment(source: string, from: number, limit: number): SegmentMatch | undefined {
  let index = from;

  // These code points belong to the source spelling but do not make a segment
  // non-empty and do not contribute to its emitted value.
  while (index < limit) {
    const codePoint = codePointAt(source, index);
    if (isDefaultIgnorable(codePoint) || (isXIDContinue(codePoint) && isCombiningMark(codePoint))) {
      index += codePoint.length;
      continue;
    }
    break;
  }

  let value = "";
  let previousWasXIDContinuation = false;
  const starterEmoji = emojiAt(source, index, limit);
  if (starterEmoji) {
    value = starterEmoji;
    index += starterEmoji.length;
  } else {
    const starter = codePointAt(source, index);
    if (!starter || (!(isXIDContinue(starter) && !isCombiningMark(starter)) && !isExtensionUnit(starter))) return undefined;
    value = starter;
    index += starter.length;
    previousWasXIDContinuation = isXIDContinue(starter);
  }

  while (index < limit) {
    const emoji = emojiAt(source, index, limit);
    if (emoji) {
      value += emoji;
      index += emoji.length;
      previousWasXIDContinuation = false;
      continue;
    }

    const codePoint = codePointAt(source, index);
    if (isDefaultIgnorable(codePoint)) {
      index += codePoint.length;
      previousWasXIDContinuation = false;
      continue;
    }
    if (
      isApostropheJoiner(codePoint) &&
      previousWasXIDContinuation &&
      isNonCombiningXIDContinuationAt(source, index + codePoint.length, limit)
    ) {
      value += codePoint;
      index += codePoint.length;
      previousWasXIDContinuation = false;
      continue;
    }
    if (isXIDContinue(codePoint) || isExtensionUnit(codePoint)) {
      value += codePoint;
      index += codePoint.length;
      previousWasXIDContinuation = isXIDContinue(codePoint);
      continue;
    }
    break;
  }

  return { to: index, value };
}

/**
 * Scan one tag candidate beginning at `from`.
 *
 * Offsets are UTF-16 offsets so callers can use them directly with Markdown
 * source positions and CodeMirror ranges.
 */
export function scanTagAt(source: string, from: number, limit = source.length): TagMatch | undefined {
  if (!isTagIntroducerAt(source, from, limit)) return undefined;

  const firstSegment = scanSegment(source, from + 1, limit);
  if (!firstSegment) return undefined;

  let to = firstSegment.to;
  let value = firstSegment.value;
  while (to < limit && source[to] === "/") {
    const nextSegment = scanSegment(source, to + 1, limit);
    if (!nextSegment) break;
    value += `/${nextSegment.value}`;
    to = nextSegment.to;
  }

  return {
    from,
    to,
    source: source.slice(from + 1, to),
    value,
  };
}

/** Enumerate every tag candidate in one eligible literal-source run. */
export function findTagMatches(source: string, from = 0, limit = source.length): TagMatch[] {
  const matches: TagMatch[] = [];
  let index = from;

  while (index < limit) {
    const emoji = emojiAt(source, index, limit);
    if (emoji) {
      index += emoji.length;
      continue;
    }

    if (source[index] === "#") {
      const match = scanTagAt(source, index, limit);
      if (match) {
        matches.push(match);
        index = match.to;
        continue;
      }
    }

    index += codePointAt(source, index).length;
  }

  return matches;
}
