import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { isSuperUser } from "@/utils/user";

export const useMemoViewDerivedState = (memo: Memo, parentPageProp?: string) => {
  const location = useLocation();
  const user = useCurrentUser();

  const isArchived = memo.state === State.ARCHIVED;
  const readonly = memo.creator !== user?.name && !isSuperUser(user);
  const parentPage = parentPageProp || location.pathname;

  return { isArchived, readonly, parentPage };
};
