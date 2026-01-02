import { timestampDate } from "@bufbuild/protobuf/wkt";
import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { RELATIVE_TIME_THRESHOLD_MS } from "./constants";

export interface MemoViewContextValue {
  memo: Memo;
  creator: User | undefined;
  currentUser: User | undefined;
  parentPage: string;
  isArchived: boolean;
  readonly: boolean;
  showNSFWContent: boolean;
  nsfw: boolean;
}

export const MemoViewContext = createContext<MemoViewContextValue | null>(null);

export const useMemoViewContext = (): MemoViewContextValue => {
  const context = useContext(MemoViewContext);
  if (!context) {
    throw new Error("useMemoViewContext must be used within MemoViewContext.Provider");
  }
  return context;
};

export const useMemoViewDerived = () => {
  const { memo, isArchived, readonly } = useMemoViewContext();
  const location = useLocation();

  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);

  const commentAmount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name,
  ).length;

  const displayTime = memo.displayTime ? timestampDate(memo.displayTime) : undefined;
  const relativeTimeFormat: "datetime" | "auto" =
    displayTime && Date.now() - displayTime.getTime() > RELATIVE_TIME_THRESHOLD_MS ? "datetime" : "auto";

  return {
    isArchived,
    readonly,
    isInMemoDetailPage,
    commentAmount,
    relativeTimeFormat,
  };
};
