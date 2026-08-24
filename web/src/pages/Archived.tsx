import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

const Archived = () => {
  const user = useCurrentUser();
  const { memoFilter: contextFilter } = useSpaceContext();

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeMemoViews: true,
    includePinned: false,
  });

  // Get sorting logic using unified hook (pinned first, archived state)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.ARCHIVED,
  });

  return (
    <PagedMemoList
      renderer={(memo: Memo, { compact }) => <MemoView key={getMemoKey(memo)} memo={memo} showVisibility compact={compact} />}
      listSort={listSort}
      state={State.ARCHIVED}
      orderBy={orderBy}
      filter={memoFilter}
      contextFilter={contextFilter}
    />
  );
};

export default Archived;
