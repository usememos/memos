import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import { useView } from "@/contexts/ViewContext";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import type { PreviewMediaItem } from "@/utils/media-item";
import { RELATIVE_TIME_THRESHOLD_MS } from "./constants";
import { isMemoDetailPath } from "./navigation";

export interface MemoViewContextValue {
  memo: Memo;
  creator: User | undefined;
  currentUser: User | undefined;
  parentPage: string;
  cardWidth: number;
  isArchived: boolean;
  readonly: boolean;
  showBlurredContent: boolean;
  blurred: boolean;
  openEditor: () => void;
  toggleBlurVisibility: () => void;
  openPreview: (items: string | string[] | PreviewMediaItem[], index?: number) => void;
}

export const MemoViewContext = createContext<MemoViewContextValue | null>(null);

// Read-only context for rendering markdown outside a real memo card (previews, the About page),
// so memo-aware renderers such as tags and task lists can mount without a memo behind them.
export const READONLY_STUB_MEMO_VIEW_CONTEXT: MemoViewContextValue = {
  memo: create(MemoSchema),
  creator: undefined,
  currentUser: undefined,
  parentPage: "/",
  cardWidth: 0,
  isArchived: false,
  readonly: true,
  showBlurredContent: false,
  blurred: false,
  openEditor: () => {},
  toggleBlurVisibility: () => {},
  openPreview: () => {},
};

export const useMemoViewContext = (): MemoViewContextValue => {
  const context = useContext(MemoViewContext);
  if (!context) {
    throw new Error("useMemoViewContext must be used within MemoViewContext.Provider");
  }
  return context;
};

export const computeCommentAmount = (memo: Memo): number =>
  memo.relations.filter((r) => r.type === MemoRelation_Type.COMMENT && r.relatedMemo?.name === memo.name).length;

export const useMemoViewDerived = () => {
  const { memo, isArchived, readonly } = useMemoViewContext();
  const { timeBasis } = useView();
  const location = useLocation();

  const isInMemoDetailPage = isMemoDetailPath(location.pathname, memo.name);
  const commentAmount = computeCommentAmount(memo);

  const createTime = memo.createTime ? timestampDate(memo.createTime) : undefined;
  const updateTime = memo.updateTime ? timestampDate(memo.updateTime) : undefined;
  const displayTime = timeBasis === "update_time" ? updateTime : createTime;
  const isDisplayingUpdatedTime =
    timeBasis === "update_time" && !!createTime && !!updateTime && updateTime.getTime() !== createTime.getTime();
  const relativeTimeFormat: "datetime" | "auto" =
    displayTime && Date.now() - displayTime.getTime() > RELATIVE_TIME_THRESHOLD_MS ? "datetime" : "auto";

  return {
    isArchived,
    readonly,
    isInMemoDetailPage,
    commentAmount,
    createTime,
    updateTime,
    displayTime,
    isDisplayingUpdatedTime,
    relativeTimeFormat,
  };
};
