export const CACHE_DEBOUNCE_DELAY = 500;

const pendingSaves = new Map<string, ReturnType<typeof window.setTimeout>>();

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

      if (content.trim()) {
        localStorage.setItem(key, content);
      } else {
        localStorage.removeItem(key);
      }
    }, CACHE_DEBOUNCE_DELAY);

    pendingSaves.set(key, timeoutId);
  },

  load(key: string): string {
    return localStorage.getItem(key) || "";
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
