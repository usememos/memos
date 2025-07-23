import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import { viewStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import memoFilterStore from "@/store/memoFilter";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Archived = observer(() => {
  const user = useCurrentUser();

  const memoFitler = useMemo(() => {
    const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
      }
    }
    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [memoFilterStore.filters]);

  return (
    <PagedMemoList
      renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility compact />}
      listSort={(memos: Memo[]) =>
        memos
          .filter((memo) => memo.state === State.ARCHIVED)
          .sort((a, b) =>
            viewStore.state.orderByTimeAsc
              ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
              : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
          )
      }
      state={State.ARCHIVED}
      orderBy={viewStore.state.orderByTimeAsc ? "display_time asc" : "display_time desc"}
      filter={memoFitler}
    />
  );
});

export default Archived;
