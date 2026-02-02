import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";

const Explore = () => {
  const currentUser = useCurrentUser();

  // Determine visibility filter based on authentication status
  // - Logged-in users: Can see PUBLIC and PROTECTED memos
  // - Visitors: Can only see PUBLIC memos
  // Note: The backend is responsible for filtering stats based on visibility permissions.
  const visibilities = currentUser ? [Visibility.PUBLIC, Visibility.PROTECTED] : [Visibility.PUBLIC];

  // Build filter using unified hook (no creator scoping for Explore)
  const memoFilter = useMemoFilters({
    includeShortcuts: false,
    includePinned: false,
    visibilities,
  });

  // Get sorting logic using unified hook (no pinned sorting)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: false,
    state: State.NORMAL,
  });

  return (
    <PagedMemoList
      renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showCreator showVisibility compact />}
      listSort={listSort}
      orderBy={orderBy}
      filter={memoFilter}
      showCreator
    />
  );
};

export default Explore;
