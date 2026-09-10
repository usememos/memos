/**
 * Client-side search over the loaded navigation config.
 *
 * Pure and dependency-free: it only reshapes the in-memory `NavConfig`, so the
 * search box never touches the RPC or localStorage. Filtering is a lowercase
 * substring match across a card's title, URL and note, because the card wall is
 * small enough that full-text ranking buys nothing.
 */

import type { NavCard, NavConfig } from "./types";

const matches = (card: { title: string; url: string; note?: string }, query: string): boolean => {
  const haystack = `${card.title} ${card.url} ${card.note ?? ""}`.toLowerCase();
  return haystack.includes(query);
};

/**
 * Returns a config whose groups contain only matching cards, dropping empty
 * groups. Groups are force-expanded so a match is always visible without the
 * user having to open a collapsed section. An empty/whitespace query returns
 * the config unchanged.
 */
export const searchNavConfig = (config: NavConfig, query: string): NavConfig => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return config;
  const groups = config.groups
    .map((group) => ({ ...group, collapsed: false, items: group.items.filter((card) => matches(card, trimmed)) }))
    .filter((group) => group.items.length > 0);
  return { ...config, groups };
};

/**
 * Flattens the visible cards in group order. Used to drive roving keyboard
 * focus: since `searchNavConfig` force-expands every surviving group, this flat
 * list is exactly the set of cards the user can reach with the arrow keys.
 */
export const flattenCards = (config: NavConfig): NavCard[] => config.groups.flatMap((group) => group.items);

/**
 * Moves a roving focus index by `delta` and wraps at both ends. A `delta` of
 * ±1 is all keyboard navigation needs; larger values are still handled
 * correctly. An empty list always yields index 0.
 */
export const cycleIndex = (index: number, delta: number, length: number): number => {
  if (length <= 0) return 0;
  const next = (index + delta) % length;
  return next < 0 ? next + length : next;
};
