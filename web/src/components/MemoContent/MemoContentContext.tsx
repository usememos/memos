import { createContext } from "react";

export interface MemoContentContextType {
  memoName?: string;
  readonly: boolean;
  disableFilter?: boolean;
  parentPage?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const MemoContentContext = createContext<MemoContentContextType>({
  readonly: true,
  disableFilter: false,
});
