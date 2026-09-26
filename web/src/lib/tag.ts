import type { CustomIconValue } from "@/lib/custom-icons";
import type { UserSetting_TagMetadata, UserSetting_TagsSetting } from "@/types/proto/api/v1/user_service_pb";

// Cache compiled regexes to avoid re-compiling on every tag render.
const compiledPatternCache = new Map<string, RegExp | null>();

/** Merge exact tag counts without inheriting Object prototype keys. */
export const mergeTagCounts = (...sources: Array<Record<string, number> | undefined>): Record<string, number> => {
  const result = Object.create(null) as Record<string, number>;
  for (const source of sources) {
    for (const [tag, count] of Object.entries(source ?? {})) result[tag] = (result[tag] ?? 0) + count;
  }
  return result;
};

const getCompiledPattern = (pattern: string): RegExp | null => {
  if (compiledPatternCache.has(pattern)) {
    return compiledPatternCache.get(pattern)!;
  }
  let re: RegExp | null = null;
  try {
    re = new RegExp(`^(?:${pattern})$`);
  } catch {
    // Invalid pattern — cache as null so we skip it without retrying.
  }
  compiledPatternCache.set(pattern, re);
  return re;
};

/**
 * Finds the first matching TagMetadata for a given tag name by treating each
 * key in tagsSetting.tags as an anchored regex pattern (^pattern$).
 *
 * Lookup order:
 * 1. Exact key match (O(1) fast path, backward-compatible).
 * 2. Iterate all keys and test as anchored regex — first match wins.
 */
export const findTagMetadata = (tag: string, tagsSetting: UserSetting_TagsSetting): UserSetting_TagMetadata | undefined => {
  // Fast path: exact match.
  if (Object.hasOwn(tagsSetting.tags, tag)) {
    return tagsSetting.tags[tag];
  }

  // Regex path: treat each key as an anchored pattern.
  for (const [pattern, metadata] of Object.entries(tagsSetting.tags)) {
    const re = getCompiledPattern(pattern);
    if (re?.test(tag)) {
      return metadata;
    }
  }

  return undefined;
};

/**
 * Returns true if the given string is a valid, ReDoS-safe JavaScript regex pattern.
 *
 * Rejects patterns with nested quantifiers (e.g. `(a+)+`) which can cause
 * catastrophic backtracking in JavaScript's regex engine.
 */
export const isValidTagPattern = (pattern: string): boolean => {
  if (!pattern) return false;
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }
  // Reject nested quantifiers: a quantified group whose body itself contains
  // a quantifier — the classic ReDoS shape e.g. (a+)+, (a*b?)+, (x|y+)+.
  if (/\((?:[^()]*[*+?{][^()]*)\)[*+?{]/.test(pattern)) {
    return false;
  }
  return true;
};

/** Whether any of the memo's tags is set to blur its content for this user. */
export const isMemoBlurred = (memo: { tags: string[] }, tagsSetting: UserSetting_TagsSetting | undefined): boolean =>
  tagsSetting !== undefined && memo.tags.some((tag) => findTagMetadata(tag, tagsSetting)?.blurContent === true);

/**
 * A leading emoji doubles as the tag's icon, flomo-style: `#📗读书` shows 📗 in place of
 * the # mark and drops the emoji from the label. Covers ZWJ sequences (👨‍👩‍👧) and skin-tone
 * modifiers (👍🏽); keycap sequences (1️⃣) are intentionally left out.
 */
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)/u;

export interface TagEmojiParts {
  icon?: string;
  text: string;
}

export const extractTagEmoji = (tag: string): TagEmojiParts => {
  const match = tag.match(LEADING_EMOJI_RE);
  if (!match) return { text: tag };
  const text = tag.slice(match[0].length);
  // An emoji-only tag name keeps its emoji as the label rather than rendering nothing.
  return text ? { icon: match[0], text } : { text: tag };
};

/** Wraps a bare emoji in the shared icon shape so both icon sources render through one component. */
export const emojiTagIcon = (emoji?: string): CustomIconValue | undefined =>
  emoji ? { value: { case: "emoji", value: emoji } } : undefined;

/** The icon configured for this tag in the user's tag settings, if any. */
export const configuredTagIcon = (tag: string, tagsSetting: UserSetting_TagsSetting | undefined): CustomIconValue | undefined => {
  const icon = tagsSetting ? findTagMetadata(tag, tagsSetting)?.icon : undefined;
  return icon?.value.case ? icon : undefined;
};

/**
 * A tag's mark, in resolution order: the icon configured in tag settings, then a leading
 * emoji in the tag name, then nothing (callers fall back to the hash mark).
 */
export const resolveTagIcon = (tag: string, tagsSetting: UserSetting_TagsSetting | undefined): CustomIconValue | undefined =>
  configuredTagIcon(tag, tagsSetting) ?? emojiTagIcon(extractTagEmoji(tag).icon);
