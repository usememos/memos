import { useEffect } from "react";

export function useFocusMode(isFocusMode: boolean): void {
  useEffect(() => {
    document.body.style.overflow = isFocusMode ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFocusMode]);
}
