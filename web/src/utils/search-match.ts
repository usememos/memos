/**
 * Locates search terms inside rendered text the same way the server's `content.contains`
 * filter does: as case-folded substrings. The server folds with Unicode case folding
 * (`cases.Fold`), which JavaScript has no direct equivalent for; upper-casing then
 * lower-casing each code point is the standard approximation and agrees with folding
 * on the cases that matter in practice (`ß` → `ss`, final sigma → `σ`, `İ` → `i̇`).
 *
 * Folding can change a string's length, so matching runs on the folded text and every
 * folded code unit remembers which original offset it came from. The ranges returned
 * are therefore always valid offsets into the original text.
 */

export interface TextRange {
  /** Inclusive start offset in the original text (UTF-16 code units). */
  start: number;
  /** Exclusive end offset in the original text. */
  end: number;
}

interface FoldedText {
  folded: string;
  /** `offsets[i]` is the original offset of folded code unit `i`; `offsets[folded.length]` is the original length. */
  offsets: number[];
}

const foldCodePoint = (codePoint: string): string => codePoint.toUpperCase().toLowerCase();

const foldText = (text: string): FoldedText => {
  let folded = "";
  const offsets: number[] = [];
  let originalOffset = 0;
  for (const codePoint of text) {
    const foldedCodePoint = foldCodePoint(codePoint);
    for (let i = 0; i < foldedCodePoint.length; i++) {
      offsets.push(originalOffset);
    }
    folded += foldedCodePoint;
    originalOffset += codePoint.length;
  }
  offsets.push(originalOffset);
  return { folded, offsets };
};

/** Folds and de-duplicates search terms once so they can be matched against many text nodes. */
export const prepareSearchTerms = (terms: readonly string[]): string[] => {
  const prepared = new Set<string>();
  for (const term of terms) {
    const folded = foldText(term.trim()).folded;
    if (folded) prepared.add(folded);
  }
  return Array.from(prepared);
};

/**
 * Every occurrence of any prepared term in `text`, as sorted, non-overlapping ranges.
 * Adjacent or overlapping hits (two terms sharing characters, or a term appearing
 * back-to-back) merge into one range so a highlight never paints the same character twice.
 */
export const findSearchMatches = (text: string, preparedTerms: readonly string[]): TextRange[] => {
  if (!text || preparedTerms.length === 0) return [];

  const { folded, offsets } = foldText(text);
  const hits: TextRange[] = [];
  for (const term of preparedTerms) {
    let from = folded.indexOf(term);
    while (from !== -1) {
      // A hit may end partway through a code point that folded to several units (`ß` → `ss`);
      // widen it to that code point's end so the range never splits an original character.
      let endIndex = from + term.length;
      while (endIndex < folded.length && offsets[endIndex] === offsets[endIndex - 1]) endIndex++;
      hits.push({ start: offsets[from], end: offsets[endIndex] });
      from = folded.indexOf(term, from + 1);
    }
  }
  if (hits.length === 0) return [];

  hits.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TextRange[] = [];
  for (const hit of hits) {
    const last = merged[merged.length - 1];
    if (last && hit.start <= last.end) {
      last.end = Math.max(last.end, hit.end);
    } else {
      merged.push({ ...hit });
    }
  }
  return merged;
};
