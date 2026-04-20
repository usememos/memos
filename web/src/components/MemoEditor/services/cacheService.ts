export const CACHE_DEBOUNCE_DELAY = 500;

const pendingSaves = new Map<string, ReturnType<typeof window.setTimeout>>();
const STRUCTURED_CACHE_ENTRY_KIND = "memos.editor-cache";
const STRUCTURED_CACHE_ENTRY_VERSION = 1;

function deserializeContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { kind?: unknown; version?: unknown; content?: unknown };
    if (
      parsed.kind === STRUCTURED_CACHE_ENTRY_KIND &&
      parsed.version === STRUCTURED_CACHE_ENTRY_VERSION &&
      typeof parsed.content === "string"
    ) {
      return parsed.content;
    }
  } catch {
    // Drafts have historically been stored as raw markdown strings.
  }

  return raw;
}

function writeEntry(key: string, content: string): void {
  if (content.trim()) {
    localStorage.setItem(key, content);
  } else {
    localStorage.removeItem(key);
  }
}

export const cacheService = {
  key: (username: string, cacheKey?: string): string => {
    return `${username}-${cacheKey || ""}`;
  },

  save: (key: string, content: string) => {
    const pendingSave = pendingSaves.get(key);
    if (pendingSave) {
      window.clearTimeout(pendingSave);
    }

    const timeoutId = window.setTimeout(() => {
      pendingSaves.delete(key);

      writeEntry(key, content);
    }, CACHE_DEBOUNCE_DELAY);

    pendingSaves.set(key, timeoutId);
  },

  saveNow: (key: string, content: string) => {
    const pendingSave = pendingSaves.get(key);
    if (pendingSave) {
      window.clearTimeout(pendingSave);
      pendingSaves.delete(key);
    }

    writeEntry(key, content);
  },

  load(key: string): string {
    const raw = localStorage.getItem(key);
    return raw ? deserializeContent(raw) : "";
  },

  clear(key: string): void {
    const pendingSave = pendingSaves.get(key);
    if (pendingSave) {
      window.clearTimeout(pendingSave);
      pendingSaves.delete(key);
    }

    localStorage.removeItem(key);
  },

  clearAll(): void {
    for (const timeoutId of pendingSaves.values()) {
      window.clearTimeout(timeoutId);
    }
    pendingSaves.clear();
  },
};
