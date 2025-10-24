import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { MemoRenderContext } from "@/components/MasonryView";
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

  // Build filter from active filters - no useMemo needed since component is MobX observer
  const buildMemoFilter = () => {
    const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
      }
    }
    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  };

  const memoFilter = buildMemoFilter();

  return (
    <PagedMemoList
      renderer={(memo: Memo, context?: MemoRenderContext) => (
        <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility compact={context?.compact} />
      )}
      listSort={(memos: Memo[]) =>
        memos
          .filter((memo) => memo.state === State.ARCHIVED)
          .sort((a, b) => {
            // First, sort by pinned status (pinned memos first)
            if (a.pinned !== b.pinned) {
              return b.pinned ? 1 : -1;
            }
            // Then sort by display time
            return viewStore.state.orderByTimeAsc
              ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
              : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix();
          })
      }
      state={State.ARCHIVED}
      orderBy={viewStore.state.orderByTimeAsc ? "pinned desc, display_time asc" : "pinned desc, display_time desc"}
      filter={memoFilter}
    />
  );
});

export default Archived;
