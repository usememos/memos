import { type HotkeyCallback, useHotkeySequences, useHotkeys } from "@tanstack/react-hotkeys";
import { useRef } from "react";
import { useKeyboardShortcutsContext } from "@/contexts/KeyboardShortcutsContext";
import { isOverlayOpen, SEQUENCE_TIMEOUT_MS, SHORTCUTS, type ShortcutId } from "@/lib/keyboard-shortcuts";

export type ShortcutHandlers = Partial<Record<ShortcutId, (() => void) | undefined>>;

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Binds handlers to catalog shortcuts (see `lib/keyboard-shortcuts.ts`) using
 * TanStack Hotkeys. Handlers may change every render. Pass `undefined` for a
 * handler to leave that shortcut unbound.
 */
export const useKeyboardShortcuts = (handlers: ShortcutHandlers, { enabled = true }: UseKeyboardShortcutsOptions = {}) => {
  const { enabled: shortcutsEnabled, isSequenceStep } = useKeyboardShortcutsContext();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const active = shortcutsEnabled && enabled;
  const bound = SHORTCUTS.filter((shortcut) => handlers[shortcut.id]);

  const guarded =
    (id: ShortcutId, single: boolean): HotkeyCallback =>
    (event) => {
      if (event.defaultPrevented || isOverlayOpen()) return;
      if (single && isSequenceStep(event)) return;
      // Prevent default only once the shortcut really fires, so ignored keys keep their browser behavior.
      event.preventDefault();
      handlersRef.current[id]?.();
    };

  const common = { enabled: active, ignoreInputs: true, preventDefault: false, stopPropagation: false, conflictBehavior: "allow" } as const;

  useHotkeys(
    bound.flatMap((shortcut) =>
      shortcut.keys
        .filter((binding) => binding.length === 1)
        .map((binding) => ({ hotkey: binding[0], callback: guarded(shortcut.id, true) })),
    ),
    common,
  );
  useHotkeySequences(
    bound.flatMap((shortcut) =>
      shortcut.keys
        .filter((binding) => binding.length > 1)
        .map((binding) => ({ sequence: [...binding], callback: guarded(shortcut.id, false) })),
    ),
    { ...common, timeout: SEQUENCE_TIMEOUT_MS },
  );
};
