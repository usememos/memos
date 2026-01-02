export const LOCALSTORAGE_DEBOUNCE_DELAY = 500;

export const FOCUS_MODE_STYLES = {
  backdrop: "fixed inset-0 bg-black/20 backdrop-blur-sm z-40",
  container: {
    base: "fixed z-50 w-auto max-w-5xl mx-auto shadow-2xl border-border h-auto overflow-y-auto",
    spacing: "top-2 left-2 right-2 bottom-2 sm:top-4 sm:left-4 sm:right-4 sm:bottom-4 md:top-8 md:left-8 md:right-8 md:bottom-8",
  },
  transition: "transition-all duration-300 ease-in-out",
  exitButton: "absolute top-2 right-2 z-10 opacity-60 hover:opacity-100",
} as const;

export const EDITOR_HEIGHT = {
  // Max height for normal mode - focus mode uses flex-1 to grow dynamically
  normal: "max-h-[50vh]",
} as const;
