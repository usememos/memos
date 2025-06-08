import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import { viewStore } from "@/store/v2";
import memoFilterStore from "@/store/v2/memoFilter";
import { Direction, State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Archived = observer(() => {
  const user = useCurrentUser();

  const memoListFilter = useMemo(() => {
    const conditions = [];
    const contentSearch: string[] = [];
    const tagSearch: string[] = [];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        contentSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "tagSearch") {
        tagSearch.push(`"${filter.value}"`);
      }
    }
    if (contentSearch.length > 0) {
      conditions.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagSearch.length > 0) {
      conditions.push(`tag_search == [${tagSearch.join(", ")}]`);
    }
    return conditions.join(" && ");
  }, [user, memoFilterStore.filters]);

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
      owner={user.name}
      state={State.ARCHIVED}
      direction={viewStore.state.orderByTimeAsc ? Direction.ASC : Direction.DESC}
      oldFilter={memoListFilter}
    />
  );
});

export default Archived;
