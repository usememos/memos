import { useCallback, useEffect, useRef } from "react";
import { cacheService } from "../services";
import { useEditorStore } from "../state";

/**
 * Persists the editor's content to localStorage as a draft. Subscribes to the
 * editor store directly for content rather than taking it as a prop, so the
 * component that mounts this hook does not re-render on every keystroke.
 */
export const useAutoSave = (username: string, cacheKey: string | undefined, enabled = true) => {
  const store = useEditorStore();
  const latestContentRef = useRef(store.getState().content);
  const discardedContentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const key = cacheService.key(username, cacheKey);
    const persist = (content: string) => {
      latestContentRef.current = content;
      if (discardedContentRef.current !== undefined && discardedContentRef.current !== content) {
        discardedContentRef.current = undefined;
      }
      cacheService.save(key, content);
    };

    // Persist the current content on mount/enable, then on every change.
    persist(store.getState().content);
    return store.subscribe(() => {
      const content = store.getState().content;
      if (content !== latestContentRef.current) {
        persist(content);
      }
    });
  }, [store, username, cacheKey, enabled]);

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
  }, [store, username, cacheKey, enabled]);

  const discardDraft = useCallback(() => {
    const key = cacheService.key(username, cacheKey);
    discardedContentRef.current = latestContentRef.current;
    cacheService.clear(key);
  }, [username, cacheKey]);

  return { discardDraft };
};
