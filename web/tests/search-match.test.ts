import { describe, expect, it } from "vitest";
import { findSearchMatches, prepareSearchTerms } from "@/utils/search-match";

const matches = (text: string, ...terms: string[]) => findSearchMatches(text, prepareSearchTerms(terms));

describe("prepareSearchTerms", () => {
  it("folds case, trims, drops empties and duplicates", () => {
    expect(prepareSearchTerms(["  Memo ", "", "memo", "MEMO", "   "])).toEqual(["memo"]);
  });
});

describe("findSearchMatches", () => {
  it("finds every occurrence of a term, ignoring case", () => {
    expect(matches("Memo memo MEMO", "memo")).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 9 },
      { start: 10, end: 14 },
    ]);
  });

  it("returns nothing without text or terms", () => {
    expect(matches("", "memo")).toEqual([]);
    expect(matches("memo")).toEqual([]);
    expect(matches("memo", "  ")).toEqual([]);
  });

  it("matches several terms and sorts the hits", () => {
    expect(matches("bravo alpha charlie", "charlie", "alpha")).toEqual([
      { start: 6, end: 11 },
      { start: 12, end: 19 },
    ]);
  });

  it("merges overlapping and adjacent hits into one range", () => {
    // "aba" at 0 and 2 overlap; "ab" is adjacent to the second "aba".
    expect(matches("ababa" + "ab", "aba", "ab")).toEqual([{ start: 0, end: 7 }]);
  });

  it("keeps original offsets across astral code points", () => {
    // The emoji is two UTF-16 units; offsets must count them.
    expect(matches("🙂 note", "note")).toEqual([{ start: 3, end: 7 }]);
  });

  it("case-folds like the server: ß matches ss without splitting the character", () => {
    expect(matches("Straße", "strasse")).toEqual([{ start: 0, end: 6 }]);
    // A hit ending inside the folded "ss" widens to cover the whole ß.
    expect(matches("aß", "as")).toEqual([{ start: 0, end: 2 }]);
  });

  it("case-folds Greek final sigma", () => {
    expect(matches("ΟΔΥΣΣΕΥΣ", "οδυσσευς")).toEqual([{ start: 0, end: 8 }]);
  });
});
