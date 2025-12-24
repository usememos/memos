import { MemoRenderContext } from "@/components/MasonryView";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

const Home = () => {
  const user = useCurrentUser();

  // Build filter using unified hook
  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: true,
    includePinned: true,
  });

  // Get sorting logic using unified hook
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <PagedMemoList
        renderer={(memo: Memo, context?: MemoRenderContext) => (
          <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact={context?.compact} />
        )}
        listSort={listSort}
        orderBy={orderBy}
        filter={memoFilter}
      />
    </div>
  );
};

export default Home;
