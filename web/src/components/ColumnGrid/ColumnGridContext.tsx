import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

interface ColumnGridUntrappedValue {
  /** Key of the tile that must not be positioned with a transform, if any. */
  untrappedKey?: string;
  /** Claims the untrapped slot for a tile. */
  setUntrappedKey: (key: string) => void;
  /** Releases the slot only if `key` still owns it. */
  clearUntrappedKey: (key: string) => void;
}

// Defaults keep MemoView working outside a grid (flow list, detail page, comments).
const ColumnGridUntrappedContext = createContext<ColumnGridUntrappedValue>({
  untrappedKey: undefined,
  setUntrappedKey: () => {},
  clearUntrappedKey: () => {},
});

/**
 * Lets one tile opt out of the grid's transform positioning while it hosts a
 * `position: fixed` surface (the inline editor's focus mode). A transformed
 * ancestor is the containing block for fixed descendants, which would trap the
 * focus-mode overlay inside the card instead of covering the viewport. The
 * leading composer tile already opts out the same way; see ColumnGrid.relayout.
 */
export function ColumnGridUntrappedProvider({ children }: { children: ReactNode }) {
  const [untrappedKey, setUntrappedKey] = useState<string>();
  // Ownership-scoped clear: mounting cards must not clobber a slot another
  // card's focused editor owns.
  const clearUntrappedKey = useCallback((key: string) => {
    setUntrappedKey((current) => (current === key ? undefined : current));
  }, []);
  // Memoized so consumers re-render only when the key itself changes; both
  // setters stay stable, so effects keyed on them do not re-run.
  const value = useMemo(() => ({ untrappedKey, setUntrappedKey, clearUntrappedKey }), [untrappedKey, clearUntrappedKey, setUntrappedKey]);
  return <ColumnGridUntrappedContext.Provider value={value}>{children}</ColumnGridUntrappedContext.Provider>;
}

export const useColumnGridUntrapped = () => useContext(ColumnGridUntrappedContext);
