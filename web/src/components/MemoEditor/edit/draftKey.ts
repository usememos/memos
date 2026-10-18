import { cacheService } from "./services/cacheService";

/** What an editing session is for, which decides where its draft and caret are kept. */
export type MemoEditIdentity =
  | { kind: "edit"; name: string }
  | { kind: "comment"; parent: string }
  | { kind: "new"; scope: string; space?: string };

/** The suffix of the draft's storage key; `cacheService.key` prefixes the user. */
export function draftKeyFor(identity: MemoEditIdentity): string {
  switch (identity.kind) {
    case "edit":
      return `edit:${identity.name}`;
    case "comment":
      return `comment:${identity.parent}`;
    case "new":
      return identity.space ? `new:${identity.scope}:${identity.space}` : `new:${identity.scope}`;
  }
}

// The keys hosts chose for themselves before the key followed the identity.
const LEGACY_SCOPE_PREFIXES: Record<string, string> = {
  home: "home-memo-editor",
  global: "global-memo-editor",
  calendar: "calendar-day-editor",
  map: "map-editor",
};

/** The key a draft for `identity` was stored under before this scheme, if it had one. */
export function legacyDraftKeyFor(identity: MemoEditIdentity): string | undefined {
  if (identity.kind === "comment") return `${identity.parent}-comment`;
  if (identity.kind !== "new") return undefined;
  const [head, ...rest] = identity.scope.split(":");
  const prefix = LEGACY_SCOPE_PREFIXES[head];
  if (!prefix) return undefined;
  const scoped = rest.length > 0 ? `${prefix}:${rest.join(":")}` : prefix;
  return identity.space ? `${scoped}:${identity.space}` : scoped;
}

/**
 * Moves a draft stored under the previous key scheme to its key under this one, once.
 * A draft already under the new key wins.
 */
export function migrateLegacyDraft(username: string, identity: MemoEditIdentity): void {
  const legacySuffix = legacyDraftKeyFor(identity);
  if (!legacySuffix) return;
  const from = cacheService.key(username, legacySuffix);
  const to = cacheService.key(username, draftKeyFor(identity));
  try {
    if (localStorage.getItem(to) !== null || localStorage.getItem(from) === null) return;
    cacheService.saveNow(to, cacheService.loadDraft(from));
    cacheService.clear(from);
  } catch {
    // Storage is unavailable; there is nothing to move.
  }
}
