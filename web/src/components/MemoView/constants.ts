/**
 * Constants for MemoView component
 */

/** CSS class for memo card styling */
export const MEMO_CARD_BASE_CLASSES =
  "relative group flex flex-col justify-start items-start bg-card w-full px-4 py-3 mb-2 gap-2 text-card-foreground rounded-lg border border-border transition-colors";

/** Keyboard shortcut keys */
export const KEYBOARD_SHORTCUTS = {
  EDIT: "e",
  ARCHIVE: "a",
} as const;

/** Text input element types for keyboard shortcut filtering */
export const TEXT_INPUT_TYPES = ["text", "search", "email", "password", "url", "tel", "number"] as const;

/** Time threshold for relative time format (24 hours in milliseconds) */
export const RELATIVE_TIME_THRESHOLD_MS = 1000 * 60 * 60 * 24;
