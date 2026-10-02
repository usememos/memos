import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcuts/KeyboardShortcutsDialog";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isTypingTarget, SEQUENCE_TIMEOUT_MS, SHORTCUTS } from "@/lib/keyboard-shortcuts";

export const KEYBOARD_SHORTCUTS_STORAGE_KEY = "memos-keyboard-shortcuts";

interface KeyboardShortcutsContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  openHelp: () => void;
  /** Whether a key press is the second step of a `g` sequence, so single-key shortcuts must not also fire. */
  isSequenceStep: (event: KeyboardEvent) => boolean;
}

// Outside the provider shortcuts are inert, so components rendered on their own keep working.
const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue>({
  enabled: false,
  setEnabled: () => undefined,
  openHelp: () => undefined,
  isSequenceStep: () => false,
});

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

// Second keys of the `g` sequences. Any other key after `g` is an ordinary key press.
const SEQUENCE_KEYS = new Set(
  SHORTCUTS.flatMap((shortcut) => shortcut.keys.filter((binding) => binding.length > 1).map((binding) => binding[1].toLowerCase())),
);

/**
 * Holds the shortcut preference and the cheat sheet. Shortcuts themselves are
 * registered with TanStack Hotkeys through `useKeyboardShortcuts`; TanStack treats
 * sequences and single keys independently, so this provider tracks the `g` prefix
 * to keep `g i` from also firing `i`.
 */
export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useLocalStorage(KEYBOARD_SHORTCUTS_STORAGE_KEY, true);
  const [helpOpen, setHelpOpen] = useState(false);
  const sequenceSteps = useRef(new WeakSet<KeyboardEvent>());

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const isSequenceStep = useCallback((event: KeyboardEvent) => sequenceSteps.current.has(event), []);

  useEffect(() => {
    if (!enabled) return;
    let prefixAt = 0;
    // Capture phase, so the flag is set before any hotkey handler sees the event.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (MODIFIER_KEYS.has(event.key)) return;
      if (prefixAt && Date.now() - prefixAt <= SEQUENCE_TIMEOUT_MS && SEQUENCE_KEYS.has(event.key.toLowerCase())) {
        sequenceSteps.current.add(event);
      }
      const isPrefix =
        event.key.toLowerCase() === "g" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingTarget(event.target);
      prefixAt = isPrefix ? Date.now() : 0;
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled]);

  const value = useMemo(() => ({ enabled, setEnabled, openHelp, isSequenceStep }), [enabled, setEnabled, openHelp, isSequenceStep]);

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </KeyboardShortcutsContext.Provider>
  );
}

export const useKeyboardShortcutsContext = () => useContext(KeyboardShortcutsContext);
