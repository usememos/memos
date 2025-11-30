import { useEffect } from "react";

/**
 * Hook to lock body scroll when focus mode is active
 */
export function useFocusMode(isFocusMode: boolean): void {
  useEffect(() => {
    document.body.style.overflow = isFocusMode ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFocusMode]);
}
