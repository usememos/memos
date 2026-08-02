import { decodeString } from "micromark-util-decode-string";

export interface MarkdownSourceBoundary {
  from: number;
  to: number;
  type: "Entity" | "Escape";
}

export interface DecodedMarkdownCharacterReference {
  to: number;
  value: string;
}

const CHARACTER_REFERENCE_AT_START = /^&(?:#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6}|[A-Za-z0-9]{1,31});/;

function isASCIIPunctuation(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    (code >= 0x21 && code <= 0x2f) || (code >= 0x3a && code <= 0x40) || (code >= 0x5b && code <= 0x60) || (code >= 0x7b && code <= 0x7e)
  );
}

/** Decode one complete CommonMark character reference starting at `from`. */
export function decodedMarkdownCharacterReferenceAt(
  source: string,
  from: number,
  to = source.length,
): DecodedMarkdownCharacterReference | undefined {
  if (source[from] !== "&") return undefined;
  const spelling = source.slice(from, Math.min(to, from + 35)).match(CHARACTER_REFERENCE_AT_START)?.[0];
  if (!spelling) return undefined;
  const value = decodeString(spelling);
  return value === spelling ? undefined : { to: from + spelling.length, value };
}

/** Find source spellings that Markdown decodes and therefore cannot join tags. */
export function findDecodedMarkdownSourceBoundaries(source: string, from = 0, to = source.length): MarkdownSourceBoundary[] {
  const ranges: MarkdownSourceBoundary[] = [];
  for (let cursor = from; cursor < to; ) {
    if (source[cursor] === "\\" && cursor + 1 < to && isASCIIPunctuation(source[cursor + 1])) {
      ranges.push({ from: cursor, to: cursor + 2, type: "Escape" });
      cursor += 2;
      continue;
    }

    const reference = decodedMarkdownCharacterReferenceAt(source, cursor, to);
    if (reference) {
      ranges.push({ from: cursor, to: reference.to, type: "Entity" });
      cursor = reference.to;
      continue;
    }

    const codePoint = source.codePointAt(cursor);
    cursor += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
  }
  return ranges;
}
