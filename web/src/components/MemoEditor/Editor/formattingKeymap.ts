import type { KeyBinding } from "@codemirror/view";
import type { EditorCommandId } from "../formatting/commands";
import { runFormattingCommand } from "./formatting";

// Keyboard shortcuts for the formatting verbs, matching what other markdown
// editors (Obsidian, Notion, chat inputs) have made muscle memory. `Mod-` is
// Cmd on macOS and Ctrl elsewhere. Each binding runs the same command the
// toolbar button does, so toggle/strip behavior can never diverge between
// mouse and keyboard.
//
// Only inline marks and link are bound: block commands (lists, headings, code
// block) have no widely shared convention, and unused bindings would shadow
// browser/OS shortcuts for no gain.
const FORMATTING_BINDINGS: [string, EditorCommandId][] = [
  ["Mod-b", "bold"],
  ["Mod-i", "italic"],
  ["Mod-Shift-x", "strikethrough"],
  ["Mod-e", "code"],
  ["Mod-k", "link"],
];

export const formattingKeymap: KeyBinding[] = FORMATTING_BINDINGS.map(([key, command]) => ({
  key,
  // Always claim the chord, even where the browser has its own use for it
  // (e.g. Ctrl-K focuses the address bar in some browsers).
  preventDefault: true,
  run: (view) => {
    runFormattingCommand(view, command);
    return true;
  },
}));
