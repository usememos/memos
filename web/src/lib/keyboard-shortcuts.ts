import type { Hotkey } from "@tanstack/react-hotkeys";

/**
 * App-level single-key shortcuts. The catalog is the single source for both
 * dispatch (`useKeyboardShortcuts`, built on TanStack Hotkeys) and the cheat sheet,
 * so the two cannot drift.
 */

export type ShortcutId =
  | "memo.new"
  | "editor.focus"
  | "search.open"
  | "filters.clear"
  | "help.open"
  | "memo.next"
  | "memo.previous"
  | "memo.open"
  | "memo.edit"
  | "memo.pin"
  | "go.back"
  | "go.home"
  | "go.explore"
  | "go.archived"
  | "go.calendar"
  | "go.map"
  | "go.attachments"
  | "go.inbox"
  | "go.settings";

export type ShortcutGroup = "general" | "memos" | "navigation";

export interface ShortcutDefinition {
  id: ShortcutId;
  /** Alternative bindings; each binding is a sequence of TanStack hotkey strings (one entry is a plain hotkey). */
  keys: readonly (readonly Hotkey[])[];
  group: ShortcutGroup;
  labelKey: string;
}

export const SHORTCUT_GROUPS: readonly { group: ShortcutGroup; labelKey: string }[] = [
  { group: "general", labelKey: "shortcuts.group-general" },
  { group: "memos", labelKey: "shortcuts.group-memos" },
  { group: "navigation", labelKey: "shortcuts.group-navigation" },
];

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  { id: "memo.new", keys: [["N"]], group: "general", labelKey: "shortcuts.new-memo" },
  { id: "editor.focus", keys: [["I"]], group: "general", labelKey: "shortcuts.focus-editor" },
  { id: "search.open", keys: [["/"]], group: "general", labelKey: "shortcuts.open-search" },
  { id: "filters.clear", keys: [["X"], ["Escape"]], group: "general", labelKey: "shortcuts.clear-filters" },
  { id: "help.open", keys: [["?"]], group: "general", labelKey: "shortcuts.show-shortcuts" },
  { id: "memo.next", keys: [["J"]], group: "memos", labelKey: "shortcuts.next-memo" },
  { id: "memo.previous", keys: [["K"]], group: "memos", labelKey: "shortcuts.previous-memo" },
  { id: "memo.open", keys: [["O"], ["Enter"]], group: "memos", labelKey: "shortcuts.open-memo" },
  { id: "memo.edit", keys: [["E"]], group: "memos", labelKey: "shortcuts.edit-memo" },
  { id: "memo.pin", keys: [["P"]], group: "memos", labelKey: "shortcuts.pin-memo" },
  { id: "go.back", keys: [["U"]], group: "navigation", labelKey: "shortcuts.go-back" },
  { id: "go.home", keys: [["G", "H"]], group: "navigation", labelKey: "shortcuts.go-home" },
  { id: "go.explore", keys: [["G", "E"]], group: "navigation", labelKey: "shortcuts.go-explore" },
  { id: "go.archived", keys: [["G", "A"]], group: "navigation", labelKey: "shortcuts.go-archived" },
  { id: "go.calendar", keys: [["G", "C"]], group: "navigation", labelKey: "shortcuts.go-calendar" },
  { id: "go.map", keys: [["G", "M"]], group: "navigation", labelKey: "shortcuts.go-map" },
  { id: "go.attachments", keys: [["G", "F"]], group: "navigation", labelKey: "shortcuts.go-attachments" },
  { id: "go.inbox", keys: [["G", "I"]], group: "navigation", labelKey: "shortcuts.go-inbox" },
  { id: "go.settings", keys: [["G", "S"]], group: "navigation", labelKey: "shortcuts.go-settings" },
];

/** How long a sequence prefix such as `g` waits for its next key. */
export const SEQUENCE_TIMEOUT_MS = 1000;

/** Whether the event comes from somewhere the user is typing. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, .cm-editor, [contenteditable]:not([contenteditable="false"])')) return true;
  return target instanceof HTMLElement && target.isContentEditable === true;
};

/** Base UI marks open popups with `data-open`; popovers also render `role="dialog"`. */
const OPEN_OVERLAY_SELECTOR = ["dialog", "alertdialog", "menu", "listbox"].map((role) => `[role="${role}"][data-open]`).join(", ");

export const isOverlayOpen = (root: ParentNode = document): boolean => root.querySelector(OPEN_OVERLAY_SELECTOR) !== null;

/** Display label for one key in a binding. */
export const formatShortcutKey = (key: string): string => {
  if (key === "Escape") return "Esc";
  return key.length === 1 ? key.toLowerCase() : key;
};
