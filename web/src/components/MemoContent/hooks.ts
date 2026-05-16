import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { COMPACT_STATES, getMaxDisplayHeight } from "./constants";
import type { ContentCompactView } from "./types";

export const useCompactMode = (enabled: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ContentCompactView | undefined>(undefined);
  const { userGeneralSetting } = useAuth();
  const alwaysExpandMemo = Boolean(userGeneralSetting?.alwaysExpandMemo);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    if (alwaysExpandMemo) {
      setMode(undefined);
      return;
    }
    const maxHeight = getMaxDisplayHeight();
    if (containerRef.current.getBoundingClientRect().height > maxHeight) {
      setMode("ALL");
    }
  }, [enabled, alwaysExpandMemo]);

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
