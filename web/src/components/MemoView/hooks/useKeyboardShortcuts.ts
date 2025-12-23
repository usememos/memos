import { useEffect } from "react";
import { KEYBOARD_SHORTCUTS, TEXT_INPUT_TYPES } from "../constants";

export interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  readonly: boolean;
  showEditor: boolean;
  isArchived: boolean;
  onEdit: () => void;
  onArchive: () => Promise<void>;
}

const isTextInputElement = (element: HTMLElement | null): boolean => {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.includes(element.type as (typeof TEXT_INPUT_TYPES)[number]);
  }
  return false;
};

export const useKeyboardShortcuts = (cardRef: React.RefObject<HTMLDivElement | null>, options: UseKeyboardShortcutsOptions) => {
  const { enabled, readonly, showEditor, isArchived, onEdit, onArchive } = options;

  useEffect(() => {
    if (!enabled || readonly || showEditor || !cardRef.current) return;

    const cardEl = cardRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!cardEl.contains(target) || isTextInputElement(target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === KEYBOARD_SHORTCUTS.EDIT) {
        event.preventDefault();
        onEdit();
      } else if (key === KEYBOARD_SHORTCUTS.ARCHIVE && !isArchived) {
        event.preventDefault();
        onArchive();
      }
    };

    cardEl.addEventListener("keydown", handleKeyDown);
    return () => cardEl.removeEventListener("keydown", handleKeyDown);
  }, [enabled, readonly, showEditor, isArchived, onEdit, onArchive, cardRef]);
};
