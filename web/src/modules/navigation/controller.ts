/**
 * Orchestration layer. `storage.ts` stays raw RPC and `cache.ts` stays raw
 * localStorage; this file is where the read path ("get or seed") and the write
 * path ("persist with crash-safety") come together.
 *
 * Read path:
 * - memo found, payload valid   -> "memo"
 * - memo found, payload broken  -> localStorage cache ("cache") or null. We
 *   never re-seed over a broken memo: it stays visible in the Archive for the
 *   user to recover or delete.
 * - no memo                     -> first visit: seed a fresh config memo.
 * - RPC failure                 -> localStorage cache ("cache"), so a flaky
 *   network still renders the last known good config read-only. With no cache
 *   to fall back to the failure is rethrown, so the UI can show a retry state
 *   instead of a misleading "reset to defaults" empty state.
 *
 * Write path: bump `rev`, snapshot the last-known-good config, upsert the memo,
 * then refresh the cache. On failure the cache is rolled back to the snapshot.
 */

import { State } from "@/types/proto/api/v1/common_pb";
import { markInitialized, readCachedConfig, readPreSaveSnapshot, writeCache, writePreSaveSnapshot } from "./cache";
import { pruneTombstones } from "./merge";
import { archiveConfigMemo, createConfigMemo, deleteConfigMemo, extractConfigFromMemo, findConfigMemo, updateConfigMemo } from "./storage";
import { createSeedConfig, type NavConfig } from "./types";

export type NavConfigSource = "memo" | "seed" | "cache";

export interface NavConfigState {
  config: NavConfig;
  memoName: string | null;
  source: NavConfigSource;
}

export interface PersistResult {
  config: NavConfig;
  memoName: string;
}

const nextRev = (config: NavConfig): NavConfig => ({
  ...config,
  rev: config.rev + 1,
  updatedAt: Date.now(),
});

export const loadOrSeedConfig = async (): Promise<NavConfigState | null> => {
  try {
    const memo = await findConfigMemo();
    if (memo) {
      const config = extractConfigFromMemo(memo);
      if (config) {
        // Heals legacy NORMAL config memos that used to appear in the timeline.
        if (memo.state !== State.ARCHIVED) {
          try {
            await archiveConfigMemo(memo.name);
            memo.state = State.ARCHIVED;
          } catch {
            // Non-fatal; the config still loads.
          }
        }
        writeCache(config);
        return { config, memoName: memo.name, source: "memo" };
      }
      const cached = readCachedConfig();
      return cached ? { config: cached, memoName: null, source: "cache" } : null;
    }
    const config = createSeedConfig();
    const created = await createConfigMemo(config);
    markInitialized();
    writeCache(config);
    return { config, memoName: created.name, source: "seed" };
  } catch (error) {
    const cached = readCachedConfig();
    if (cached) return { config: cached, memoName: null, source: "cache" };
    throw error;
  }
};

export const persistConfig = async (
  next: NavConfig,
  prev: { config: NavConfig | null; memoName: string | null },
): Promise<PersistResult> => {
  const config = pruneTombstones(nextRev(next));
  if (prev.config) writePreSaveSnapshot(prev.config);
  try {
    let memoName = prev.memoName;
    if (!memoName) {
      // Degraded/cache path has no memoName. Look up the existing config memo first
      // so a save while the service is back does not fork a second config memo.
      const existing = await findConfigMemo();
      memoName = existing?.name ?? null;
    }
    const memo = memoName ? await updateConfigMemo(memoName, config) : await createConfigMemo(config);
    markInitialized();
    writeCache(config);
    return { config, memoName: memo.name };
  } catch (error) {
    const snapshot = readPreSaveSnapshot();
    if (snapshot) writeCache(snapshot);
    throw error;
  }
};

/**
 * Drops the config memo (best effort) and re-seeds. Deletion is best-effort so a
 * transient failure cannot leave the user stranded; the fresh seed still wins on
 * the next load either way.
 */
export const resetConfig = async (memoName: string | null): Promise<NavConfigState | null> => {
  if (memoName) {
    try {
      await deleteConfigMemo(memoName);
    } catch {
      // best effort
    }
  }
  return loadOrSeedConfig();
};
