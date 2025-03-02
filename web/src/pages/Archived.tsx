import dayjs from "dayjs";
import { useMemo } from "react";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoFilterStore } from "@/store/v1";
import { Direction, State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Archived = () => {
  const user = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();

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
            memoFilterStore.orderByTimeAsc
              ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
              : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
          )
      }
      owner={user.name}
      state={State.ARCHIVED}
      direction={memoFilterStore.orderByTimeAsc ? Direction.ASC : Direction.DESC}
      oldFilter={memoListFilter}
    />
  );
};

export default Archived;
