/**
 * The single source of truth for memos' `#tag` lexing grammar, shared by the
 * editor tokenizer + serialize-escape (components/MemoEditor/Editor/Tag.ts and
 * tagMarkdown.ts) and the read-only renderer (utils/remark-plugins/remark-tag.ts)
 * so they can't drift.
 *
 * A tag character is any Unicode letter, mark, number, or symbol, plus
 * `_ - / &`. The mark class (`\p{M}`) keeps combining marks — Indic vowel
 * signs, Arabic harakat, Hebrew niqqud, decomposed accents — attached to the
 * base letters they belong to, so a tag like `#കവിത` isn't cut short at its
 * first vowel sign.
 * A tag run is capped at MAX_TAG_LENGTH characters.
 */
export const TAG_CHAR_CLASS = "[\\p{L}\\p{M}\\p{N}\\p{S}_\\-/&]";

export const MAX_TAG_LENGTH = 100;

/**
 * Regex source for a *capped* tag run: 1..MAX_TAG_LENGTH tag characters,
 * refusing to match when a (MAX+1)-th tag character would follow (an over-long
 * run is not a tag). Embed with the `u` flag.
 *
 * The two halves of the round-trip build on this same source so they can't
 * disagree on what counts as a tag: the editor's input rule + tokenizer match
 * `#(${TAG_RUN})`, and the serialize-escape (tagMarkdown.ts) escapes a `#`
 * followed by `(?=${TAG_RUN})`.
 */
export const TAG_RUN = `${TAG_CHAR_CLASS}{1,${MAX_TAG_LENGTH}}(?!${TAG_CHAR_CLASS})`;

// Matches exactly one tag character. The `u` flag makes the class match whole
// code points, so astral-plane symbols (emoji et al.) are tested intact rather
// than as lone surrogates.
const SINGLE_TAG_CHAR = new RegExp(`^${TAG_CHAR_CLASS}$`, "u");

/** Whether a single character (one code point) is allowed inside a tag. */
export function isTagChar(char: string): boolean {
  return SINGLE_TAG_CHAR.test(char);
}
