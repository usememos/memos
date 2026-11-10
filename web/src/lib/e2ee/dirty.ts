// Track presence only, never content, so unrelated surfaces can safely request a lock or dismissal.
const drafts = new Set<symbol>();
export function registerEncryptedDraft() {
  const id = Symbol();
  drafts.add(id);
  return () => {
    drafts.delete(id);
  };
}
export function confirmEncryptedDiscard(message: string) {
  return drafts.size === 0 || window.confirm(message);
}
