/**
 * MemoEditor Constants
 * Centralized configuration for the memo editor component
 */

/**
 * Debounce delay for localStorage writes (in milliseconds)
 * Prevents excessive writes on every keystroke
 */
export const LOCALSTORAGE_DEBOUNCE_DELAY = 500;

/**
 * Focus Mode styling constants
 * Centralized to make it easy to adjust appearance
 */
export const FOCUS_MODE_STYLES = {
  backdrop: "fixed inset-0 bg-black/20 backdrop-blur-sm z-40",
  container: {
    base: "fixed z-50 w-auto max-w-5xl mx-auto shadow-2xl border-border h-auto overflow-y-auto",
    /**
     * Responsive spacing using explicit positioning:
     * - Mobile (< 640px): 8px margin
     * - Tablet (640-768px): 16px margin
     * - Desktop (> 768px): 32px margin
     */
    spacing: "top-2 left-2 right-2 bottom-2 sm:top-4 sm:left-4 sm:right-4 sm:bottom-4 md:top-8 md:left-8 md:right-8 md:bottom-8",
  },
  transition: "transition-all duration-300 ease-in-out",
  exitButton: "absolute top-2 right-2 z-10 opacity-60 hover:opacity-100",
} as const;

/**
 * Focus Mode keyboard shortcuts
 * - Toggle: Cmd/Ctrl + Shift + F (matches GitHub, Google Docs convention)
 * - Exit: Escape key
 */
export const FOCUS_MODE_TOGGLE_KEY = "f";
export const FOCUS_MODE_EXIT_KEY = "Escape";

/**
 * Editor height constraints
 * - Normal mode: Limited to 50% viewport height to avoid excessive scrolling
 * - Focus mode: Minimum 50vh on mobile, 60vh on desktop for immersive writing
 */
export const EDITOR_HEIGHT = {
  normal: "max-h-[50vh]",
  focusMode: {
    mobile: "min-h-[50vh]",
    desktop: "md:min-h-[60vh]",
  },
} as const;

/**
 * Geocoding API configuration
 */
export const GEOCODING = {
  endpoint: "https://nominatim.openstreetmap.org/reverse",
  userAgent: "Memos/1.0 (https://github.com/usememos/memos)",
  format: "json",
} as const;
