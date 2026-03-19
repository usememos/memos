import { useEffect, useRef } from "react";
import { cacheService } from "../services";

export const useAutoSave = (content: string, username: string, cacheKey: string | undefined) => {
  const latestContentRef = useRef(content);
  const latestKeyRef = useRef(cacheService.key(username, cacheKey));

  useEffect(() => {
    const key = cacheService.key(username, cacheKey);
    latestContentRef.current = content;
    latestKeyRef.current = key;
    cacheService.save(key, content);
  }, [content, username, cacheKey]);

  useEffect(() => {
    const flushPendingSave = () => {
      cacheService.save(latestKeyRef.current, latestContentRef.current);
      cacheService.flush();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingSave);
    window.addEventListener("beforeunload", flushPendingSave);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingSave);
      window.removeEventListener("beforeunload", flushPendingSave);
    };
  }, []);
};
