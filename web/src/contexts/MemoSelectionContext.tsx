import { createContext, useContext } from "react";

export interface MemoSelectionContextValue {
  isSelectionMode: boolean;
  selectedMemoNames: Set<string>;
  selectedCount: number;
  isSelected: (name: string) => boolean;
  toggleMemoSelection: (name: string) => void;
  enterSelectionMode: (name?: string) => void;
  exitSelectionMode: () => void;
}

export const MemoSelectionContext = createContext<MemoSelectionContextValue | null>(null);

export const useMemoSelection = () => useContext(MemoSelectionContext);
