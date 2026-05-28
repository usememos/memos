import { useCallback, useEffect, useRef } from "react";
import { cacheService } from "../services";

export const useAutoSave = (content: string, username: string, cacheKey: string | undefined, enabled = true) => {
  const latestContentRef = useRef(content);
  const discardedContentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    latestContentRef.current = content;
    if (discardedContentRef.current !== undefined && discardedContentRef.current !== content) {
      discardedContentRef.current = undefined;
    }
  }, [content]);

  useEffect(() => {
    if (!enabled) return;

    const key = cacheService.key(username, cacheKey);
    cacheService.save(key, content);
  }, [content, username, cacheKey, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const key = cacheService.key(username, cacheKey);
    const flushDraft = () => {
      if (discardedContentRef.current === latestContentRef.current) {
        return;
      }

      cacheService.saveNow(key, latestContentRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Flush on unmount (e.g. editor closes) to ensure the draft is persisted
      // before the component is torn down — distinct from the visibility flush above.
      flushDraft();
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [username, cacheKey, enabled]);

  const discardDraft = useCallback(() => {
    const key = cacheService.key(username, cacheKey);
    discardedContentRef.current = latestContentRef.current;
    cacheService.clear(key);
  }, [username, cacheKey]);

  return { discardDraft };
};
