/**
 * The single source of truth for memos' `#tag` lexing grammar, shared by the
 * editor tokenizer (components/MemoEditor/Editor/Tag.ts) and the read-only
 * renderer (utils/remark-plugins/remark-tag.ts) so the two can't drift.
 *
 * A tag character is any Unicode letter, number, or symbol, plus `_ - / &`.
 * A tag run is capped at MAX_TAG_LENGTH characters.
 */
export const TAG_CHAR_CLASS = "[\\p{L}\\p{N}\\p{S}_\\-/&]";

export const MAX_TAG_LENGTH = 100;

// Matches exactly one tag character. The `u` flag makes the class match whole
// code points, so astral-plane symbols (emoji et al.) are tested intact rather
// than as lone surrogates.
const SINGLE_TAG_CHAR = new RegExp(`^${TAG_CHAR_CLASS}$`, "u");

/** Whether a single character (one code point) is allowed inside a tag. */
export function isTagChar(char: string): boolean {
  return SINGLE_TAG_CHAR.test(char);
}
