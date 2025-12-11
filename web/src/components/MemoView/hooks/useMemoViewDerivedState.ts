import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { isSuperUser } from "@/utils/user";
import { RELATIVE_TIME_THRESHOLD_MS } from "../constants";

export const useMemoViewDerivedState = (memo: Memo, parentPageProp?: string) => {
  const location = useLocation();
  const user = useCurrentUser();

  const commentAmount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name,
  ).length;

  const displayTime = memo.displayTime ? timestampDate(memo.displayTime) : undefined;
  const relativeTimeFormat: "datetime" | "auto" =
    displayTime && Date.now() - displayTime.getTime() > RELATIVE_TIME_THRESHOLD_MS ? "datetime" : "auto";

  const isArchived = memo.state === State.ARCHIVED;
  const readonly = memo.creator !== user?.name && !isSuperUser(user);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);
  const parentPage = parentPageProp || location.pathname;

  return { commentAmount, relativeTimeFormat, isArchived, readonly, isInMemoDetailPage, parentPage };
};
