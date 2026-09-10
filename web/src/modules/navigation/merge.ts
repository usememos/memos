/**
 * Conflict resolution for concurrent navigation-config writes.
 *
 * The config memo has no server-side CAS (UpdateMemo only requires a non-empty
 * update mask), so concurrent tabs race. `update_time` on the memo row only has
 * second precision, hence the in-payload `rev` counter as tiebreaker, and
 * union-by-id alone would resurrect deleted cards, hence tombstones.
 */

import type { NavCard, NavConfig, NavGroup, NavTombstone } from "./types";
import { NAV_CONFIG_VERSION } from "./types";

const byId = <T extends { id: string }>(items: T[]): Map<string, T> => {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(item.id)) map.set(item.id, item);
  return map;
};

const mergeTombstones = (a: NavTombstone[], b: NavTombstone[]): NavTombstone[] => {
  const latest = new Map<string, number>();
  for (const t of [...a, ...b]) latest.set(t.id, Math.max(latest.get(t.id) ?? 0, t.deletedAt));
  return [...latest.entries()].map(([id, deletedAt]) => ({ id, deletedAt })).sort((x, y) => y.deletedAt - x.deletedAt);
};

const isDeleted = (tombstones: Map<string, number>, card: NavCard): boolean => {
  const deletedAt = tombstones.get(card.id);
  return deletedAt !== undefined && deletedAt > card.updatedAt;
};

const mergeCards = (a: NavCard[], b: NavCard[], tombstones: Map<string, number>): NavCard[] => {
  const merged = byId([...a, ...b]);
  const result: NavCard[] = [];
  for (const card of merged.values()) {
    if (!isDeleted(tombstones, card)) result.push(card);
  }
  // Group-internal order: most recently updated first, a stable, merge-safe order.
  return result.sort((x, y) => y.updatedAt - x.updatedAt || x.id.localeCompare(y.id));
};

const mergeGroups = (a: NavGroup[], b: NavGroup[], tombstones: Map<string, number>): NavGroup[] => {
  const merged = byId([...a, ...b]);
  const result: NavGroup[] = [];
  for (const group of merged.values()) {
    const twin = [...a, ...b].find((g) => g.id === group.id && g !== group);
    result.push({
      ...group,
      collapsed: twin ? group.collapsed && twin.collapsed : group.collapsed,
      items: twin ? mergeCards(group.items, twin.items, tombstones) : group.items,
    });
  }
  return result;
};

/**
 * Merges two configs. Returns `winner` untouched when revisions are comparable
 * (one is a strict superset of the other's state); otherwise performs a
 * card-level union. Callers persist the snapshot before applying, so a bad
 * merge is always recoverable from localStorage.
 */
export const mergeNavConfigs = (local: NavConfig, remote: NavConfig): NavConfig => {
  const base = local.rev >= remote.rev ? local : remote;
  const other = local.rev >= remote.rev ? remote : local;
  const tombstones = mergeTombstones(base.tombstones, other.tombstones);
  const tombstoneMap = new Map(tombstones.map((t) => [t.id, t.deletedAt]));
  return {
    version: NAV_CONFIG_VERSION,
    rev: Math.max(local.rev, remote.rev) + 1,
    updatedAt: Date.now(),
    groups: mergeGroups(base.groups, other.groups, tombstoneMap),
    tombstones,
  };
};

export const pruneTombstones = (config: NavConfig, maxAgeDays = 30, maxCount = 100): NavConfig => {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const kept = config.tombstones.filter((t) => t.deletedAt >= cutoff).slice(0, maxCount);
  return kept.length === config.tombstones.length ? config : { ...config, tombstones: kept };
};
