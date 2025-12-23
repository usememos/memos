import { debounce } from "lodash-es";

export const CACHE_DEBOUNCE_DELAY = 500;

export const cacheService = {
  key: (username: string, cacheKey?: string): string => {
    return `${username}-${cacheKey || ""}`;
  },

  save: debounce((key: string, content: string) => {
    if (content.trim()) {
      localStorage.setItem(key, content);
    } else {
      localStorage.removeItem(key);
    }
  }, CACHE_DEBOUNCE_DELAY),

  load(key: string): string {
    return localStorage.getItem(key) || "";
  },

  clear(key: string): void {
    localStorage.removeItem(key);
  },
};
