import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMPACT_STATES, getMaxDisplayHeight } from "./constants";
import type { ContentCompactView } from "./types";

export const useCompactMode = (enabled: boolean, resetKey?: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ContentCompactView | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      setMode(undefined);
      return;
    }

    const maxHeight = getMaxDisplayHeight();
    if (containerRef.current.getBoundingClientRect().height > maxHeight) {
      setMode("ALL");
      return;
    }

    setMode(undefined);
  }, [enabled, resetKey]);

  const toggle = useCallback(() => {
    if (!mode) return;
    setMode(COMPACT_STATES[mode].next);
  }, [mode]);

  return useMemo(() => ({ containerRef, mode, toggle }), [mode, toggle]);
};

export const useCompactLabel = (mode: ContentCompactView | undefined, t: (key: string) => string): string => {
  if (!mode) return "";
  return t(COMPACT_STATES[mode].textKey);
};
