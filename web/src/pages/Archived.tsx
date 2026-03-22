import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

const Archived = () => {
  const user = useCurrentUser();

  // Build filter using unified hook (no shortcuts or pinned filter)
  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: false,
    includePinned: false,
  });

  // Get sorting logic using unified hook (pinned first, archived state)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.ARCHIVED,
  });

  return (
    <PagedMemoList
      renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility compact />}
      listSort={listSort}
      state={State.ARCHIVED}
      orderBy={orderBy}
      filter={memoFilter}
    />
  );
};

export default Archived;
