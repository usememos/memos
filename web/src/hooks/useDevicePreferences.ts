import { useSyncExternalStore } from "react";

/**
 * Presentation choices kept in this browser only. Nothing here reaches the server, so they
 * differ from account settings (locale, theme, default visibility) that follow the user across
 * devices, and from the Timeline view options, which only shape the feed.
 */
export interface DevicePreferences {
  /** Render bare links as preview cards wherever a memo is shown. */
  linkPreview: boolean;
  /** Double-clicking an editable memo opens it in the editor. */
  doubleClickEdit: boolean;
}

export const DEVICE_PREFERENCES_KEY = "memos-device-preferences";

const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = { linkPreview: true, doubleClickEdit: false };

const readBoolean = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const parse = (raw: string | null): DevicePreferences => {
  if (raw === null) return DEFAULT_DEVICE_PREFERENCES;
  try {
    const data = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      linkPreview: readBoolean(data.linkPreview, DEFAULT_DEVICE_PREFERENCES.linkPreview),
      doubleClickEdit: readBoolean(data.doubleClickEdit, DEFAULT_DEVICE_PREFERENCES.doubleClickEdit),
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

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

if (typeof window !== "undefined") {
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
