import { debounce } from "lodash-es";

export const CACHE_DEBOUNCE_DELAY = 500;

const persistCache = (key: string, content: string) => {
  if (content.trim()) {
    localStorage.setItem(key, content);
  } else {
    localStorage.removeItem(key);
  }
};

const debouncedSave = debounce(persistCache, CACHE_DEBOUNCE_DELAY);

export const cacheService = {
  key: (username: string, cacheKey?: string): string => {
    return `${username}-${cacheKey || ""}`;
  },

  save(key: string, content: string): void {
    debouncedSave(key, content);
  },

  flush(): void {
    debouncedSave.flush();
  },

  load(key: string): string {
    return localStorage.getItem(key) || "";
  },

  clear(key: string): void {
    localStorage.removeItem(key);
  },
};
