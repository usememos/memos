import { useSyncExternalStore } from "react";

/**
 * Reading choices kept in this browser only. Nothing here reaches the server, so they differ
 * from account settings (locale, theme, default visibility) that follow the user across
 * devices, and from the Timeline view options, which only shape the feed. A choice that
 * applies wherever memos are listed belongs here, not in a view option.
 */
export interface DevicePreferences {
  /** Render bare links as preview cards wherever a memo is shown. */
  linkPreview: boolean;
  /** Double-clicking an editable memo opens it in the editor. */
  doubleClickEdit: boolean;
  /** Collapse longer memos in every memo list. A grid layout collapses them regardless. */
  compactMode: boolean;
  /** Show comments beside memos in every memo list, and count them in the lists' statistics. */
  includeComments: boolean;
}

export const DEVICE_PREFERENCES_KEY = "memos-device-preferences";

const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  linkPreview: true,
  doubleClickEdit: false,
  compactMode: false,
  includeComments: false,
};

const readBoolean = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const parse = (raw: string | null): DevicePreferences => {
  if (raw === null) return DEFAULT_DEVICE_PREFERENCES;
  try {
    const data = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      linkPreview: readBoolean(data.linkPreview, DEFAULT_DEVICE_PREFERENCES.linkPreview),
      doubleClickEdit: readBoolean(data.doubleClickEdit, DEFAULT_DEVICE_PREFERENCES.doubleClickEdit),
      compactMode: readBoolean(data.compactMode, DEFAULT_DEVICE_PREFERENCES.compactMode),
      includeComments: readBoolean(data.includeComments, DEFAULT_DEVICE_PREFERENCES.includeComments),
    };
  } catch (error) {
    console.warn("Failed to load device preferences from localStorage:", error);
    return DEFAULT_DEVICE_PREFERENCES;
  }
};

// The snapshot is re-read from storage on every read but only re-created when the stored text
// changes, so React sees a stable object while nothing moved and picks up writes from other
// tabs or a cleared storage without a reset hook.
let lastRaw: string | null = null;
let snapshot = DEFAULT_DEVICE_PREFERENCES;

const getSnapshot = (): DevicePreferences => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DEVICE_PREFERENCES_KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    snapshot = parse(raw);
  }
  return snapshot;
};

/**
 * Compact mode was a Timeline view option before it applied to every list. A choice saved
 * there is copied here once, so it outlives the Timeline options being saved again without
 * it. Nothing is copied once compact mode has a value of its own here.
 */
export function carryOverTimelineCompactMode(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(DEVICE_PREFERENCES_KEY) ?? "null") as Partial<DevicePreferences> | null;
    if (typeof stored?.compactMode === "boolean") return;
    const timeline = JSON.parse(localStorage.getItem("memos-view-setting") ?? "null") as { compactMode?: unknown } | null;
    if (typeof timeline?.compactMode !== "boolean") return;
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify({ ...stored, compactMode: timeline.compactMode }));
  } catch (error) {
    console.warn("Failed to carry over the saved compact mode:", error);
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

if (typeof window !== "undefined") {
  carryOverTimelineCompactMode();
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === DEVICE_PREFERENCES_KEY) notify();
  });
}

export function updateDevicePreferences(patch: Partial<DevicePreferences>): void {
  const next = { ...getSnapshot(), ...patch };
  try {
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(next));
  } catch (error) {
    // Keep the choice for this page even when it cannot be persisted.
    console.warn("Failed to persist device preferences:", error);
    snapshot = next;
  }
  notify();
}

export function useDevicePreferences(): DevicePreferences {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_DEVICE_PREFERENCES);
}
