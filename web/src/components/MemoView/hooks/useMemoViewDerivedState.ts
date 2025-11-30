import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common";
import type { Memo } from "@/types/proto/api/v1/memo_service";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { isSuperUser } from "@/utils/user";
import { RELATIVE_TIME_THRESHOLD_MS } from "../constants";

export const useMemoViewDerivedState = (memo: Memo, parentPageProp?: string) => {
  const location = useLocation();
  const user = useCurrentUser();

  const commentAmount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name,
  ).length;

  const relativeTimeFormat: "datetime" | "auto" =
    memo.displayTime && Date.now() - memo.displayTime.getTime() > RELATIVE_TIME_THRESHOLD_MS ? "datetime" : "auto";

  const isArchived = memo.state === State.ARCHIVED;
  const readonly = memo.creator !== user?.name && !isSuperUser(user);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);
  const parentPage = parentPageProp || location.pathname;

  return { commentAmount, relativeTimeFormat, isArchived, readonly, isInMemoDetailPage, parentPage };
};
