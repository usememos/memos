import { createContext, useContext } from "react";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";

// Stable values that rarely change
export interface MemoViewStaticContextValue {
  memo: Memo;
  creator: User | undefined;
  isArchived: boolean;
  readonly: boolean;
  isInMemoDetailPage: boolean;
  parentPage: string;
}

// Dynamic values that change frequently
export interface MemoViewDynamicContextValue {
  commentAmount: number;
  relativeTimeFormat: "datetime" | "auto";
  nsfw: boolean;
  showNSFWContent: boolean;
}

export interface MemoViewContextValue extends MemoViewStaticContextValue, MemoViewDynamicContextValue {}

export const MemoViewContext = createContext<MemoViewContextValue | null>(null);

export const useMemoViewContext = (): MemoViewContextValue => {
  const context = useContext(MemoViewContext);
  if (!context) {
    throw new Error("useMemoViewContext must be used within MemoViewContext.Provider");
  }
  return context;
};
