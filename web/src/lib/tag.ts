import type { UserSetting_TagMetadata, UserSetting_TagsSetting } from "@/types/proto/api/user_service_pb";

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

// Keep in sync with maxFilterExpressionSize in filter/engine.go (Unicode code points).
const MAX_FILTER_LENGTH = 8192;
const regexSyntax = /[.*+?^${}()|[\]\\]/;

interface TagRuleUsage {
  count?: number;
  filter?: string;
}

/** Resolve an exact memo count locally, or build one filter that counts the union on the server. */
export const getTagRuleUsage = (rule: string, tagCounts: Record<string, number>): TagRuleUsage => {
  if (!regexSyntax.test(rule)) {
    return { count: Object.hasOwn(tagCounts, rule) ? tagCounts[rule] : 0 };
  }

  let filter: string;
  const prefix = rule.slice(0, -2);
  if (rule.endsWith(".*") && !regexSyntax.test(prefix)) {
    filter = `tags.exists(t, t.startsWith(${JSON.stringify(prefix)}))`;
  } else {
    const pattern = getCompiledPattern(rule);
    const tags = Object.keys(tagCounts).filter((tag) => tag === rule || pattern?.test(tag));
    if (tags.length === 0) return { count: 0 };
    if (tags.length === 1) return { count: tagCounts[tags[0]] };

    // Each list becomes an OR chain in SQL. Group shorter chains in the same query to stay below SQLite's expression depth limit.
    tags.sort();
    const groups: string[] = [];
    for (let i = 0; i < tags.length; i += 500) {
      groups.push(`tag in ${JSON.stringify(tags.slice(i, i + 500))}`);
    }
    filter = groups.join(" || ");
  }
  return Array.from(filter).length <= MAX_FILTER_LENGTH ? { filter } : {};
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
