import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";

const Explore = () => {
  const currentUser = useCurrentUser();
  const { memoFilter: contextFilter, selectedSpaceName } = useSpaceContext();

  // Determine visibility filter based on authentication status
  // - Logged-in users: Can see PUBLIC and PROTECTED memos, plus SPACE memos while a Space is selected
  // - Visitors: Can only see PUBLIC memos
  // Note: The backend is responsible for filtering stats based on visibility permissions.
  const visibilities = currentUser
    ? [Visibility.PUBLIC, Visibility.PROTECTED, ...(selectedSpaceName ? [Visibility.SPACE] : [])]
    : [Visibility.PUBLIC];

  const memoFilter = useMemoFilters({
    includeMemoViews: true,
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
      renderer={(memo: Memo, { compact }) => <MemoView key={getMemoKey(memo)} memo={memo} showCreator showVisibility compact={compact} />}
      listSort={listSort}
      orderBy={orderBy}
      filter={memoFilter}
      contextFilter={contextFilter}
      showCreator
    />
  );
};

export default Explore;
