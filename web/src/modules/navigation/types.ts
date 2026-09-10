/**
 * Navigation module data model.
 *
 * Self-contained on purpose: nothing here imports from upstream feature code,
 * so the whole module can be rebased across upstream upgrades with zero
 * surface outside `modules/navigation/` (plus the patches in PATCHES.md).
 */

export const NAV_CONFIG_VERSION = 1;

/** Marker written as the first line of the config memo content. Never use `#…`: it would leak into the user's tag list. */
export const NAV_CONFIG_MARKER = "nav-config:v1";
/** Prefix-only form for the server-side CEL lookup, so a future `v2` stays discoverable. */
export const NAV_CONFIG_MARKER_PREFIX = "nav-config:";

export interface NavCard {
  id: string;
  title: string;
  url: string;
  note?: string;
  updatedAt: number;
}

export interface NavGroup {
  id: string;
  name: string;
  collapsed: boolean;
  items: NavCard[];
}

export interface NavTombstone {
  id: string;
  deletedAt: number;
}

export interface NavConfig {
  version: number;
  /** Monotonic revision; tiebreaker for same-second memo `update_time` values. */
  rev: number;
  updatedAt: number;
  groups: NavGroup[];
  /** Deletion markers so a concurrent edit cannot resurrect a removed card. */
  tombstones: NavTombstone[];
}

export const NAV_CONFIG_CONTENT_LIMIT = 100_000;

export const NAV_STORAGE_KEYS = {
  initialized: "nav-config-initialized",
  cache: "nav-config-cache",
} as const;

/** The seed shown on first visit; every card is removable via the editor. */
export const createSeedConfig = (): NavConfig => ({
  version: NAV_CONFIG_VERSION,
  rev: 1,
  updatedAt: Date.now(),
  groups: [
    {
      id: "g-common",
      name: "常用",
      collapsed: false,
      items: [
        { id: "c-memos", title: "Memos", url: "https://usememos.com", updatedAt: Date.now() },
        { id: "c-github", title: "GitHub", url: "https://github.com", updatedAt: Date.now() },
      ],
    },
    {
      id: "g-dev",
      name: "开发",
      collapsed: false,
      items: [{ id: "c-mdn", title: "MDN", url: "https://developer.mozilla.org", updatedAt: Date.now() }],
    },
    {
      id: "g-media",
      name: "娱乐",
      collapsed: false,
      items: [],
    },
  ],
  tombstones: [],
});
