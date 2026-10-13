export const FOCUS_MODE_STYLES = {
  backdrop: "fixed inset-0 bg-overlay/20 backdrop-blur-sm z-overlay",
  container: {
    base: "fixed z-50 w-auto max-w-5xl mx-auto shadow-2xl border-border h-auto overflow-y-auto",
    spacing: "top-2 left-2 right-2 bottom-2 sm:top-4 sm:left-4 sm:right-4 sm:bottom-4 md:top-8 md:left-8 md:right-8 md:bottom-8",
  },
  transition: "transition-all duration-300 ease-in-out",
} as const;
