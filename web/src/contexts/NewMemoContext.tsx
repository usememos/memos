import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

interface NewMemoContextValue {
  // Name of the most recently created memo in this view, or null. Only one
  // memo is ever "new" at a time: creating another overwrites it, which clears
  // the previous one for free.
  newMemoName: string | null;
  markNewMemo: (name: string) => void;
}

// Default is a safe no-op so MemoEditor/MemoView rendered outside a provider
// (dialogs, detail pages, other lists) keep working without a "new" marker.
const NewMemoContext = createContext<NewMemoContextValue>({
  newMemoName: null,
  markNewMemo: () => {},
});

export function NewMemoProvider({ children }: { children: ReactNode }) {
  const [newMemoName, setNewMemoName] = useState<string | null>(null);
  // setNewMemoName is identity-stable, so the value only changes with newMemoName.
  // Memoize it so a Home re-render doesn't cascade into every subscribed memo row.
  const value = useMemo(() => ({ newMemoName, markNewMemo: setNewMemoName }), [newMemoName]);

  return <NewMemoContext.Provider value={value}>{children}</NewMemoContext.Provider>;
}

export function useNewMemo() {
  return useContext(NewMemoContext);
}
