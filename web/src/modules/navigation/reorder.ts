/**
 * Pure reordering helpers for drag-and-drop (M4).
 *
 * Dependency-free and side-effect-free: they only reshape the in-memory
 * `NavConfig`, so a drag gesture never touches RPC or localStorage here — the
 * caller persists the returned config through the normal `save` path, which
 * bumps `rev` and refreshes the cache. All helpers return the *original*
 * config reference when nothing would change, so callers can skip the write.
 */

import type { NavCard, NavConfig, NavGroup } from "./types";

export const clampIndex = (index: number, length: number): number => Math.max(0, Math.min(index, length));

export const findCardLocation = (config: NavConfig, cardId: string): { card: NavCard; groupId: string; index: number } | null => {
  for (const group of config.groups) {
    const index = group.items.findIndex((card) => card.id === cardId);
    if (index >= 0) return { card: group.items[index], groupId: group.id, index };
  }
  return null;
};

const removeAt = <T>(items: T[], index: number): T[] => [...items.slice(0, index), ...items.slice(index + 1)];

const insertAt = <T>(items: T[], index: number, value: T): T[] => [...items.slice(0, index), value, ...items.slice(index)];

export const findGroupLocation = (config: NavConfig, groupId: string): { group: NavGroup; index: number } | null => {
  const index = config.groups.findIndex((group) => group.id === groupId);
  if (index < 0) return null;
  return { group: config.groups[index], index };
};

/**
 * Moves a card to a target group at a drop index. The drop index is expressed
 * against the *original* arrays — for a same-group move past the source slot it
 * is decremented once, matching how a user perceives "insert before/after that
 * card". Returns the original config when the drop is a no-op (same slot), when
 * the card or target group is unknown.
 */
export const moveCard = (config: NavConfig, cardId: string, destGroupId: string, dropIndex: number): NavConfig => {
  const from = findCardLocation(config, cardId);
  const target = findGroupLocation(config, destGroupId);
  if (!from || !target) return config;

  const sameGroup = target.group.id === from.groupId;

  // Remove the card, then resolve the insert index against the shortened array.
  let index = dropIndex;
  if (sameGroup && from.index < index) index -= 1;
  // After the decrement above, landing back on the source slot means the drop
  // did not change anything ("insert before the card right after it").
  index = clampIndex(index, target.group.items.length - (sameGroup ? 1 : 0));
  if (sameGroup && index === from.index) return config;

  const groups = config.groups.map((group): NavGroup => {
    const items = group.id === from.groupId ? removeAt(group.items, from.index) : group.items;
    if (group.id !== destGroupId) return { ...group, items };
    return { ...group, items: insertAt(items, index, from.card) };
  });
  return { ...config, groups };
};

/**
 * Moves a group to a drop index, again expressed against the original ordering.
 * Returns the original config when the drop is a no-op or the group is unknown.
 */
export const moveGroup = (config: NavConfig, groupId: string, dropIndex: number): NavConfig => {
  const from = findGroupLocation(config, groupId);
  if (!from) return config;
  // Same original-frame semantics as moveCard: decrement once when the slot
  // sits past the source, clamp to the shortened array, and treat landing back
  // on the source slot as a no-op.
  let index = dropIndex;
  if (index > from.index) index -= 1;
  index = clampIndex(index, config.groups.length - 1);
  if (index === from.index) return config;
  const groups = removeAt(config.groups, from.index);
  return { ...config, groups: insertAt(groups, index, from.group) };
};
