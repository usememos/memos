/**
 * The single source of truth for memos' `@mention` lexing grammar, shared by the
 * editor tokenizer (components/MemoEditor/Editor/Mention.ts) and the read-only
 * renderer (utils/remark-plugins/remark-mention.ts) so they can't drift.
 *
 * A mention character is an ASCII letter, digit, or hyphen. A username is capped
 * at MAX_MENTION_LENGTH characters and must contain at least one letter or digit
 * (a run of only hyphens is not a mention). This matches the Go backend parser
 * (internal/markdown/parser/mention.go).
 */
export const MENTION_CHAR_CLASS = "[A-Za-z0-9-]";

export const MAX_MENTION_LENGTH = 32;

/**
 * Regex source for a username run: 1..MAX_MENTION_LENGTH mention characters that
 * include at least one letter or digit. Unlike TAG_RUN this does not refuse an
 * over-long run — a 33rd mention character simply falls outside the capture and
 * becomes ordinary text, mirroring the read-only parser's truncation. The
 * leading lookahead enforces the "must contain an alphanumeric" rule so `@---`
 * is left as plain text. Embed after an `@`, e.g. `^@(${MENTION_RUN})`.
 */
export const MENTION_RUN = `(?=${MENTION_CHAR_CLASS}{0,${MAX_MENTION_LENGTH - 1}}[A-Za-z0-9])${MENTION_CHAR_CLASS}{1,${MAX_MENTION_LENGTH}}`;

const SINGLE_MENTION_CHAR = /^[A-Za-z0-9-]$/;

/** Whether a single character is allowed inside a username. */
export function isMentionChar(char: string): boolean {
  return SINGLE_MENTION_CHAR.test(char);
}
