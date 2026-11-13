/** Whether keystrokes on this target are text input that global shortcuts must not steal. */
const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null);

/**
 * Global Quick Find shortcut: ⌘K / Ctrl+K anywhere, or a bare `/` outside text input.
 * Ctrl+P is avoided because browsers reserve it for printing.
 */
export const isQuickFindShortcut = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.isComposing || event.repeat) return false;
  const key = event.key.toLowerCase();
  if (key === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) return true;
  return key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableTarget(event.target);
};
