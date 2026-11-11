// Track presence only, never content, so unrelated surfaces can safely request a lock or dismissal.
const drafts = new Set<symbol>();
/** Tracks a mounted dirty draft and returns its unregister callback. */
export function registerEncryptedDraft() {
  const id = Symbol();
  drafts.add(id);
  return () => {
    drafts.delete(id);
  };
}
/** Requests confirmation only when a dirty encrypted draft would be discarded. */
export function confirmEncryptedDiscard(message: string) {
  return drafts.size === 0 || window.confirm(message);
}
