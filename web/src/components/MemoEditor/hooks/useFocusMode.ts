import { useCallback, useEffect } from "react";

interface UseFocusModeOptions {
  isFocusMode: boolean;
  onToggle: () => void;
}

interface UseFocusModeReturn {
  toggleFocusMode: () => void;
}

/**
 * Custom hook for managing focus mode functionality
 * Handles:
 * - Body scroll lock when focus mode is active
 * - Toggle functionality
 * - Cleanup on unmount
 */
export function useFocusMode({ isFocusMode, onToggle }: UseFocusModeOptions): UseFocusModeReturn {
  // Lock body scroll when focus mode is active to prevent background scrolling
  useEffect(() => {
    if (isFocusMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFocusMode]);

  const toggleFocusMode = useCallback(() => {
    onToggle();
  }, [onToggle]);

  return {
    toggleFocusMode,
  };
}
