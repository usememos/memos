import type { InstanceSetting_TagMetadata, InstanceSetting_TagsSetting } from "@/types/proto/api/v1/instance_service_pb";

// Cache compiled regexes to avoid re-compiling on every tag render.
const compiledPatternCache = new Map<string, RegExp | null>();

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
export const findTagMetadata = (tag: string, tagsSetting: InstanceSetting_TagsSetting): InstanceSetting_TagMetadata | undefined => {
  // Fast path: exact match.
  if (tagsSetting.tags[tag]) {
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
