/**
 * localStorage cache + crash-safety snapshot.
 *
 * The memo is the source of truth; this cache serves read-only degraded mode
 * (fetch failure, signed-out preview) and keeps a pre-write snapshot so a
 * failed or interrupted save never loses the last known good config.
 */

import { NAV_STORAGE_KEYS, type NavConfig } from "./types";
import { parseNavConfig } from "./validate";

const readRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage might be unavailable (private mode, quota); degrade silently.
  }
};

export const readCachedConfig = (): NavConfig | null => {
  const raw = readRaw(NAV_STORAGE_KEYS.cache);
  return raw ? parseNavConfig(raw) : null;
};

export const writeCache = (config: NavConfig): void => {
  writeRaw(NAV_STORAGE_KEYS.cache, JSON.stringify(config));
};

export const clearCache = (): void => {
  try {
    localStorage.removeItem(NAV_STORAGE_KEYS.cache);
    localStorage.removeItem(NAV_STORAGE_KEYS.initialized);
  } catch {
    // ignore
  }
};

export const markInitialized = (): void => {
  try {
    localStorage.setItem(NAV_STORAGE_KEYS.initialized, "1");
  } catch {
    // ignore
  }
};

export const isInitialized = (): boolean => {
  try {
    return localStorage.getItem(NAV_STORAGE_KEYS.initialized) === "1";
  } catch {
    return false;
  }
};

/** Written immediately before every persist attempt; the last-resort recovery copy. */
export const writePreSaveSnapshot = (config: NavConfig): void => {
  writeRaw(`${NAV_STORAGE_KEYS.cache}:snapshot`, JSON.stringify(config));
};

export const readPreSaveSnapshot = (): NavConfig | null => {
  const raw = readRaw(`${NAV_STORAGE_KEYS.cache}:snapshot`);
  return raw ? parseNavConfig(raw) : null;
};

export const exportConfig = (config: NavConfig): string => JSON.stringify(config, null, 2);

export const importConfig = (raw: string): NavConfig | null => parseNavConfig(raw);
