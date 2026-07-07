import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, LoaderCircleIcon } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useNewMemo } from "@/contexts/NewMemoContext";
import { useView } from "@/contexts/ViewContext";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE, SKELETON_LOADING_DELAY_MS } from "@/helpers/consts";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { hoistMemoToFront } from "@/hooks/useMemoSorting";
import { userKeys } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import ColumnGrid, { columnCountForWidth, GRID_GAP } from "../ColumnGrid";
import MemoEditor from "../MemoEditor";
import MemoFilters from "../MemoFilters";
import Placeholder from "../Placeholder";
import Skeleton from "../Skeleton";

// Memo identity for React keys and the grid's sticky column assignments. The pages use it
// for their renderer keys too, so flow-list and grid identity can never drift apart.
export const getMemoKey = (memo: Memo) => `${memo.name}-${memo.updateTime}`;

// Columns never stretch past this, so 2 columns on a wide monitor stay readable and the
// grid centers in the leftover space instead of filling it.
const MAX_COLUMN_WIDTH = 420;

// The grid packs cards into columns, so a card-shaped skeleton doesn't fit; use a spinner.
const GridLoader = () => (
  <div className="w-full flex flex-row justify-center items-center py-8">
    <LoaderCircleIcon className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

interface Props {
  renderer: (memo: Memo, options: { compact: boolean }) => ReactElement;
  listSort?: (list: Memo[]) => Memo[];
  state?: State;
  orderBy?: string;
  filter?: string;
  pageSize?: number;
  showCreator?: boolean;
  enabled?: boolean;
  /** When true, render the inline MemoEditor above the list (e.g. on the Home page). */
  showMemoEditor?: boolean;
}

function useAutoFetchWhenNotScrollable({
  hasNextPage,
  isFetchingNextPage,
  memoCount,
  onFetchNext,
}: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  memoCount: number;
  onFetchNext: () => Promise<unknown>;
}) {
  const autoFetchTimeoutRef = useRef<number | null>(null);

  const isPageScrollable = useCallback(() => {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return documentHeight > window.innerHeight + 100;
  }, []);

  const checkAndFetchIfNeeded = useCallback(async () => {
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const shouldFetch = !isPageScrollable() && hasNextPage && !isFetchingNextPage && memoCount > 0;

    if (shouldFetch) {
      await onFetchNext();

      autoFetchTimeoutRef.current = window.setTimeout(() => {
        void checkAndFetchIfNeeded();
      }, 500);
    }
  }, [hasNextPage, isFetchingNextPage, memoCount, isPageScrollable, onFetchNext]);

  useEffect(() => {
    if (!isFetchingNextPage && memoCount > 0) {
      void checkAndFetchIfNeeded();
    }
  }, [memoCount, isFetchingNextPage, checkAndFetchIfNeeded]);

  useEffect(() => {
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, []);
}

const PagedMemoList = (props: Props) => {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const { filters } = useMemoFilterContext();
  const { maxColumns, compactMode } = useView();
  // maxColumns is a ceiling: 1 = single reading column, 0 = as many as fit. The single
  // column renders in normal document flow; anything wider becomes the packed grid.
  const multiColumn = maxColumns !== 1;

  // Measure the available width: when it only fits one column anyway, render the flow
  // layout rather than a degenerate one-column grid (capped tiles, composer-as-tile).
  // Only the boolean is stored, so continuous resizes re-render nothing until the
  // one-column threshold is actually crossed.
  const layoutMeasureRef = useRef<HTMLDivElement>(null);
  const [fitsGridWidth, setFitsGridWidth] = useState<boolean | undefined>(undefined);
  useLayoutEffect(() => {
    const el = layoutMeasureRef.current;
    if (!el) return;
    const apply = (nextWidth: number) => setFitsGridWidth(columnCountForWidth(nextWidth) >= 2);
    apply(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const useGrid = multiColumn && (fitsGridWidth ?? true);
  // Grid tiles are always bounded/compact; the narrow-width fallback behaves exactly like
  // maxColumns = 1, so it respects the user's own compact setting. Centralized here so the
  // pages don't each repeat the policy.
  const effectiveCompact = compactMode || useGrid;

  const showMemoEditor = props.showMemoEditor ?? false;
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteMemos(
    {
      state: props.state || State.NORMAL,
      orderBy: props.orderBy || "create_time desc",
      filter: props.filter,
      pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
    },
    { enabled: props.enabled ?? true },
  );

  // Only show the skeleton once loading exceeds the delay, so fast loads don't flash it.
  const showSkeleton = useDelayedFlag(isLoading, SKELETON_LOADING_DELAY_MS);

  // Flatten pages into a single array of memos
  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) || [], [data]);

  // Apply custom sorting if provided, otherwise use memos directly, then hoist
  // a freshly created memo to the very top so it stays visible above pins.
  const { newMemoName } = useNewMemo();
  const sortedMemoList = useMemo(() => {
    const sorted = props.listSort ? props.listSort(memos) : memos;
    return hoistMemoToFront(sorted, newMemoName);
  }, [memos, props.listSort, newMemoName]);

  // Prefetch creators when new data arrives to improve performance
  useEffect(() => {
    if (!data?.pages || !props.showCreator) return;

    const lastPage = data.pages[data.pages.length - 1];
    if (!lastPage?.memos) return;

    const uniqueCreators = Array.from(new Set(lastPage.memos.map((memo) => memo.creator)));
    for (const creator of uniqueCreators) {
      void queryClient.prefetchQuery({
        queryKey: userKeys.detail(creator),
        queryFn: async () => {
          const user = await userServiceClient.getUser({ name: creator });
          return user;
        },
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [data?.pages, props.showCreator, queryClient]);

  // Auto-fetch hook: fetches more content when page isn't scrollable
  useAutoFetchWhenNotScrollable({
    hasNextPage,
    isFetchingNextPage,
    memoCount: sortedMemoList.length,
    onFetchNext: fetchNextPage,
  });

  // Infinite scroll: fetch more when user scrolls near bottom
  useEffect(() => {
    if (!hasNextPage) return;

    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // In the grid the leading stack owns all spacing (GRID_GAP), so the composer carries
  // its own bottom margin only in the flow layout.
  const memoEditor = showMemoEditor ? (
    <MemoEditor
      className={useGrid ? undefined : "mb-2"}
      cacheKey="home-memo-editor"
      placeholder={t("editor.any-thoughts")}
      defaultCreateTime={defaultCreateTime}
    />
  ) : null;

  // A freshly created memo is hoisted to the front; pin it to the top of column one so it
  // appears right under the composer instead of dropping into a random (shortest) column.
  const firstMemo = sortedMemoList[0];
  const priorityKey = newMemoName && firstMemo?.name === newMemoName ? getMemoKey(firstMemo) : undefined;

  // Stable reference so MentionResolutionProvider's memo (keyed on the array) actually holds.
  const contents = useMemo(() => sortedMemoList.map((memo) => memo.content), [sortedMemoList]);

  // Column one is the action column: the composer and any active filters head it, and the
  // newest memo lands directly beneath them (priorityKey above). Every vertical seam inside
  // the stack uses GRID_GAP so y-spacing matches the grid's x-spacing exactly.
  const hasFilters = filters.length > 0;
  const gridLeading =
    memoEditor || hasFilters ? (
      <div className="flex w-full flex-col" style={{ gap: GRID_GAP }}>
        {memoEditor}
        <MemoFilters />
      </div>
    ) : undefined;

  // Pagination skeleton, empty state, and back-to-top are identical across both layouts.
  const footer = (
    <>
      {isFetchingNextPage && (useGrid ? <GridLoader /> : <Skeleton showCreator={props.showCreator} count={2} />)}
      {!isFetchingNextPage && !hasNextPage && sortedMemoList.length === 0 && !memoEditor && (
        <Placeholder variant="empty" message={t("message.no-data")} />
      )}
      {!isFetchingNextPage && (hasNextPage || sortedMemoList.length > 0) && (
        <div className="w-full opacity-70 flex flex-row justify-center items-center my-4">
          <BackToTop />
        </div>
      )}
    </>
  );

  const children = (
    <MentionResolutionProvider contents={contents}>
      <div ref={layoutMeasureRef} className="w-full">
        <div className={cn("flex flex-col justify-start w-full mx-auto", useGrid ? "max-w-none" : "max-w-2xl")}>
          {/* During initial load, show the skeleton only after the delay; render nothing before then to avoid a flash. */}
          {isLoading ? (
            showSkeleton ? (
              useGrid ? (
                <GridLoader />
              ) : (
                <Skeleton showCreator={props.showCreator} count={4} />
              )
            ) : null
          ) : useGrid ? (
            <>
              <ColumnGrid
                items={sortedMemoList}
                getKey={getMemoKey}
                renderItem={(memo) => props.renderer(memo, { compact: effectiveCompact })}
                leading={gridLeading}
                priorityKey={priorityKey}
                maxColumns={maxColumns}
                maxColumnWidth={MAX_COLUMN_WIDTH}
              />
              {footer}
            </>
          ) : (
            <>
              {memoEditor}
              <MemoFilters className="mb-2" />
              {sortedMemoList.map((memo) => props.renderer(memo, { compact: effectiveCompact }))}
              {footer}
            </>
          )}
        </div>
      </div>
    </MentionResolutionProvider>
  );

  return children;
};

const BackToTop = () => {
  const t = useTranslate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 400;
      setIsVisible(shouldShow);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <Button variant="ghost" onClick={scrollToTop}>
      {t("router.back-to-top")}
      <ArrowUpIcon className="ml-1 w-4 h-auto" />
    </Button>
  );
};

export default PagedMemoList;
