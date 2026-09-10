/**
 * Validation for untrusted navigation-config payloads.
 *
 * Hand-written instead of pulling in zod: the shape is small, the module must
 * stay dependency-free, and a failure here always degrades to the localStorage
 * cache rather than rendering half-broken data.
 */

import { NAV_CONFIG_MARKER, NAV_CONFIG_MARKER_PREFIX, NAV_CONFIG_VERSION, type NavCard, type NavConfig, type NavGroup } from "./types";

export const isValidHttpUrl = (value: string): boolean => {
  if (!/^(https?:\/\/)\S+$/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const asTrimmedString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value.trim() : fallback);

const asTimestamp = (value: unknown): number => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : Date.now();
  return n >= 0 ? n : Date.now();
};

const parseCard = (value: unknown, seenUrls: Set<string>): NavCard | null => {
  if (!isRecord(value)) return null;
  const url = asTrimmedString(value.url);
  const title = asTrimmedString(value.title);
  if (!isValidHttpUrl(url) || !title) return null;
  // A duplicated URL renders two cards that fight over one edit; keep the first.
  const dedupeKey = url.toLowerCase();
  if (seenUrls.has(dedupeKey)) return null;
  seenUrls.add(dedupeKey);
  const note = asTrimmedString(value.note);
  return {
    id: asTrimmedString(value.id) || `c-${Math.random().toString(36).slice(2, 10)}`,
    title: title.slice(0, 200),
    url: url.slice(0, 2048),
    ...(note ? { note: note.slice(0, 500) } : {}),
    updatedAt: asTimestamp(value.updatedAt),
  };
};

const parseGroup = (value: unknown, seenIds: Set<string>): NavGroup | null => {
  if (!isRecord(value)) return null;
  const name = asTrimmedString(value.name);
  if (!name) return null;
  let id = asTrimmedString(value.id);
  if (!id || seenIds.has(id)) id = `g-${Math.random().toString(36).slice(2, 10)}`;
  seenIds.add(id);
  const seenUrls = new Set<string>();
  const items = Array.isArray(value.items)
    ? value.items.map((item) => parseCard(item, seenUrls)).filter((item): item is NavCard => item !== null)
    : [];
  return { id, name: name.slice(0, 100), collapsed: value.collapsed === true, items };
};

/** Returns a sanitized config, or null when the payload is unusable. */
export const parseNavConfig = (raw: string): NavConfig | null => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== NAV_CONFIG_VERSION) return null;

  const seenGroupIds = new Set<string>();
  const groups = Array.isArray(data.groups)
    ? data.groups.map((group) => parseGroup(group, seenGroupIds)).filter((group): group is NavGroup => group !== null)
    : [];
  const tombstones = Array.isArray(data.tombstones)
    ? data.tombstones
        .map((t) => {
          if (!isRecord(t)) return null;
          const id = asTrimmedString(t.id);
          return id ? { id, deletedAt: asTimestamp(t.deletedAt) } : null;
        })
        .filter((t): t is { id: string; deletedAt: number } => t !== null)
    : [];

  return {
    version: NAV_CONFIG_VERSION,
    rev: typeof data.rev === "number" && Number.isFinite(data.rev) ? data.rev : 0,
    updatedAt: asTimestamp(data.updatedAt),
    groups,
    tombstones,
  };
};

/**
 * Extracts and parses the fenced JSON block of a config memo content.
 * Returns null when the marker is present but the payload is missing/broken —
 * callers decide between "not a config memo" and "config memo, bad payload".
 */
export const extractConfigPayload = (content: string): { raw: string; config: NavConfig | null } | null => {
  if (!content.startsWith(NAV_CONFIG_MARKER_PREFIX)) return null;
  const lines = content.split("\n");
  if (lines[0]?.trim() !== NAV_CONFIG_MARKER) return null;
  const fenced = content.slice(lines[0].length).trim();
  const match = fenced.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  if (!match) return { raw: "", config: null };
  const raw = match[1].trim();
  return { raw, config: parseNavConfig(raw) };
};
