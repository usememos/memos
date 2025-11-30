import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common";
import type { Memo } from "@/types/proto/api/v1/memo_service";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { isSuperUser } from "@/utils/user";
import { RELATIVE_TIME_THRESHOLD_MS } from "../constants";

export interface UseMemoViewDerivedStateOptions {
  memo: Memo;
  parentPage?: string;
}

export interface UseMemoViewDerivedStateReturn {
  commentAmount: number;
  relativeTimeFormat: "datetime" | "auto";
  isArchived: boolean;
  readonly: boolean;
  isInMemoDetailPage: boolean;
  parentPage: string;
}

/**
 * Hook for computing derived state from memo data
 * Centralizes all computed values to avoid repetition and improve readability
 */
export const useMemoViewDerivedState = (options: UseMemoViewDerivedStateOptions): UseMemoViewDerivedStateReturn => {
  const { memo, parentPage: parentPageProp } = options;
  const location = useLocation();
  const user = useCurrentUser();

  // Compute all derived state
  const commentAmount = useMemo(
    () =>
      memo.relations.filter((relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name).length,
    [memo.relations, memo.name],
  );

  const relativeTimeFormat: "datetime" | "auto" = useMemo(
    () => (memo.displayTime && Date.now() - memo.displayTime.getTime() > RELATIVE_TIME_THRESHOLD_MS ? "datetime" : "auto"),
    [memo.displayTime],
  );

  const isArchived = useMemo(() => memo.state === State.ARCHIVED, [memo.state]);

  const readonly = useMemo(() => memo.creator !== user?.name && !isSuperUser(user), [memo.creator, user]);

  const isInMemoDetailPage = useMemo(() => location.pathname.startsWith(`/${memo.name}`), [location.pathname, memo.name]);

  const parentPage = useMemo(() => parentPageProp || location.pathname, [parentPageProp, location.pathname]);

  return {
    commentAmount,
    relativeTimeFormat,
    isArchived,
    readonly,
    isInMemoDetailPage,
    parentPage,
  };
};
