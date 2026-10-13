/** Focuses the editable surface of a MemoEditor mounted inside `container`. Returns whether one was found. */
export const focusEditorIn = (container: HTMLElement | null | undefined): boolean => {
  const codeMirrorContent = container?.querySelector<HTMLElement>('.cm-content[contenteditable="true"]');
  const fallbackInput = container?.querySelector<HTMLElement>("textarea, input");
  const target = codeMirrorContent ?? fallbackInput;
  target?.focus();
  return Boolean(target);
};
