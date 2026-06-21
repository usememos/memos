import { useCallback, useEffect, useRef, useState } from "react";
import { COMPACT_STATES, getCompactTriggerHeightPx, shouldCompactContent } from "./constants";
import type { ContentCompactView } from "./types";

export const useCompactMode = (enabled: boolean, revision: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ContentCompactView | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      setMode(undefined);
      return;
    }

    const contentHeight = Math.max(containerRef.current.scrollHeight, containerRef.current.getBoundingClientRect().height);
    const shouldCompact = shouldCompactContent(contentHeight, getCompactTriggerHeightPx());
    setMode((currentMode) => {
      if (!shouldCompact) {
        return undefined;
      }
      return currentMode ?? "ALL";
    });
  }, [enabled, revision]);

  const toggle = useCallback(() => {
    if (!mode) return;
    setMode(COMPACT_STATES[mode].next);
  }, [mode]);

  return { containerRef, mode, toggle };
};

export const useCompactLabel = (mode: ContentCompactView | undefined, t: (key: string) => string): string => {
  if (!mode) return "";
  return t(COMPACT_STATES[mode].textKey);
};
