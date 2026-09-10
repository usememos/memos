/**
 * Pure add/edit/delete helpers for the navigation config (M5).
 *
 * Same contract as `reorder.ts`: reshape the in-memory config only, return the
 * original reference when nothing would change, and never touch RPC or
 * localStorage — the caller persists through `save`. Deletes leave tombstones
 * so a concurrent tab cannot resurrect the card.
 */

import type { NavCard, NavConfig, NavGroup } from "./types";
import { isValidHttpUrl } from "./validate";

const newId = (prefix: "c" | "g"): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export interface CardDraft {
  title: string;
  url: string;
  note?: string;
}

export type CardDraftError = "titleRequired" | "urlInvalid" | "urlDuplicate";

export const validateCardDraft = (draft: CardDraft, config: NavConfig, exceptCardId?: string): CardDraftError | null => {
  const title = draft.title.trim();
  const url = draft.url.trim();
  if (!title) return "titleRequired";
  if (!isValidHttpUrl(url)) return "urlInvalid";
  const key = url.toLowerCase();
  for (const group of config.groups) {
    for (const card of group.items) {
      if (card.id === exceptCardId) continue;
      if (card.url.toLowerCase() === key) return "urlDuplicate";
    }
  }
  return null;
};

export const createCard = (draft: CardDraft, now = Date.now()): NavCard => {
  const title = draft.title.trim();
  const url = draft.url.trim();
  const note = draft.note?.trim();
  return {
    id: newId("c"),
    title: title.slice(0, 200),
    url: url.slice(0, 2048),
    ...(note ? { note: note.slice(0, 500) } : {}),
    updatedAt: now,
  };
};

export const addCard = (config: NavConfig, groupId: string, card: NavCard): NavConfig => {
  if (!config.groups.some((group) => group.id === groupId)) return config;
  if (config.groups.some((group) => group.items.some((item) => item.id === card.id))) return config;
  return {
    ...config,
    groups: config.groups.map((group) => (group.id === groupId ? { ...group, items: [...group.items, card] } : group)),
  };
};

export const updateCard = (config: NavConfig, cardId: string, draft: CardDraft, now = Date.now()): NavConfig => {
  const title = draft.title.trim().slice(0, 200);
  const url = draft.url.trim().slice(0, 2048);
  const note = draft.note?.trim().slice(0, 500) ?? "";
  let changed = false;
  const groups = config.groups.map((group): NavGroup => {
    if (!group.items.some((card) => card.id === cardId)) return group;
    return {
      ...group,
      items: group.items.map((card): NavCard => {
        if (card.id !== cardId) return card;
        if (card.title === title && card.url === url && (card.note ?? "") === note) return card;
        changed = true;
        const { note: _previousNote, ...base } = card;
        return {
          ...base,
          title,
          url,
          ...(note ? { note } : {}),
          updatedAt: now,
        };
      }),
    };
  });
  return changed ? { ...config, groups } : config;
};

export const removeCard = (config: NavConfig, cardId: string, now = Date.now()): NavConfig => {
  const groups = config.groups.map((group) =>
    group.items.some((card) => card.id === cardId) ? { ...group, items: group.items.filter((card) => card.id !== cardId) } : group,
  );
  if (groups.every((group, index) => group === config.groups[index])) return config;
  return {
    ...config,
    groups,
    tombstones: [...config.tombstones.filter((t) => t.id !== cardId), { id: cardId, deletedAt: now }],
  };
};

export const addGroup = (config: NavConfig, name: string): NavConfig => {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return config;
  const group: NavGroup = { id: newId("g"), name: trimmed, collapsed: false, items: [] };
  return { ...config, groups: [...config.groups, group] };
};

export const renameGroup = (config: NavConfig, groupId: string, name: string): NavConfig => {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return config;
  let changed = false;
  const groups = config.groups.map((group): NavGroup => {
    if (group.id !== groupId || group.name === trimmed) return group;
    changed = true;
    return { ...group, name: trimmed };
  });
  return changed ? { ...config, groups } : config;
};

export const removeGroup = (config: NavConfig, groupId: string, now = Date.now()): NavConfig => {
  const target = config.groups.find((group) => group.id === groupId);
  if (!target) return config;
  const tombstones = [
    ...config.tombstones.filter((t) => !target.items.some((card) => card.id === t.id)),
    ...target.items.map((card) => ({ id: card.id, deletedAt: now })),
  ];
  return {
    ...config,
    groups: config.groups.filter((group) => group.id !== groupId),
    tombstones,
  };
};
