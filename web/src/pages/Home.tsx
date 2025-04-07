import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoFilterStore } from "@/store/v1";
import { userStore } from "@/store/v2";
import { Direction, State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Home = observer(() => {
  const user = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();
  const selectedShortcut = userStore.state.shortcuts.find((shortcut) => shortcut.id === memoFilterStore.shortcut);

  const memoListFilter = useMemo(() => {
    const conditions = [];
    const contentSearch: string[] = [];
    const tagSearch: string[] = [];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        contentSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "tagSearch") {
        tagSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "property.hasLink") {
        conditions.push(`has_link == true`);
      } else if (filter.factor === "property.hasTaskList") {
        conditions.push(`has_task_list == true`);
      } else if (filter.factor === "property.hasCode") {
        conditions.push(`has_code == true`);
      } else if (filter.factor === "displayTime") {
        const filterDate = new Date(filter.value);
        const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
        const timestampAfter = filterUtcTimestamp / 1000;
        conditions.push(`display_time_after == ${timestampAfter}`);
        conditions.push(`display_time_before == ${timestampAfter + 60 * 60 * 24}`);
      }
    }
    if (contentSearch.length > 0) {
      conditions.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagSearch.length > 0) {
      conditions.push(`tag_search == [${tagSearch.join(", ")}]`);
    }
    return conditions.join(" && ");
  }, [user, memoFilterStore.filters, memoFilterStore.orderByTimeAsc]);

  return (
    <PagedMemoList
      renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact />}
      listSort={(memos: Memo[]) =>
        memos
          .filter((memo) => memo.state === State.NORMAL)
          .sort((a, b) =>
            memoFilterStore.orderByTimeAsc
              ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
              : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
          )
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      }
      owner={user.name}
      direction={memoFilterStore.orderByTimeAsc ? Direction.ASC : Direction.DESC}
      filter={selectedShortcut?.filter || ""}
      oldFilter={memoListFilter}
    />
  );
});

export default Home;
