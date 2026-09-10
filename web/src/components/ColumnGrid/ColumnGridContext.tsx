import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

interface ColumnGridUntrappedValue {
  /** Keys of tiles that must not be positioned with a transform. */
  untrappedKeys: ReadonlySet<string>;
  /** Adds a tile to the untrapped set. */
  setUntrappedKey: (key: string) => void;
  /** Removes a tile from the untrapped set. */
  clearUntrappedKey: (key: string) => void;
}

// Defaults keep MemoView working outside a grid (flow list, detail page, comments).
const ColumnGridUntrappedContext = createContext<ColumnGridUntrappedValue>({
  untrappedKeys: new Set(),
  setUntrappedKey: () => {},
  clearUntrappedKey: () => {},
});

/**
 * Lets tiles opt out of the grid's transform positioning while they host a
 * `position: fixed` surface (the inline editor's focus mode). A transformed
 * ancestor is the containing block for fixed descendants, which would trap the
 * focus-mode overlay inside the card instead of covering the viewport. The
 * leading composer tile already opts out the same way; see ColumnGrid.relayout.
 *
 * A set, not a single key: inline editors are independently openable, so more
 * than one card can hold focus mode at a time and each must keep its own tile
 * untrapped.
 */
export function ColumnGridUntrappedProvider({ children }: { children: ReactNode }) {
  const [untrappedKeys, setUntrappedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const setUntrappedKey = useCallback((key: string) => {
    setUntrappedKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);
  const clearUntrappedKey = useCallback((key: string) => {
    setUntrappedKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);
  // Memoized so consumers re-render only when the set itself changes; both
  // callbacks stay stable, so effects keyed on them do not re-run.
  const value = useMemo(() => ({ untrappedKeys, setUntrappedKey, clearUntrappedKey }), [untrappedKeys, setUntrappedKey, clearUntrappedKey]);
  return <ColumnGridUntrappedContext.Provider value={value}>{children}</ColumnGridUntrappedContext.Provider>;
}

export const useColumnGridUntrapped = () => useContext(ColumnGridUntrappedContext);
