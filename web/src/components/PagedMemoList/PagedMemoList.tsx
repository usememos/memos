import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchPath } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import { useView } from "@/contexts/ViewContext";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { Routes } from "@/router";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";
import type { MemoRenderContext } from "../MasonryView";
import MasonryView from "../MasonryView";
import MemoEditor from "../MemoEditor";
import MemoFilters from "../MemoFilters";
import Skeleton from "../Skeleton";

interface Props {
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  state?: State;
  orderBy?: string;
  filter?: string;
  pageSize?: number;
  showCreator?: boolean;
  enabled?: boolean;
  collapsiblePinned?: boolean;
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
  const { layout } = useView();
  const queryClient = useQueryClient();

  // Show memo editor only on the root route
  const showMemoEditor = Boolean(matchPath(Routes.ROOT, window.location.pathname));

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteMemos(
    {
      state: props.state || State.NORMAL,
      orderBy: props.orderBy || "display_time desc",
      filter: props.filter,
      pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
    },
    { enabled: props.enabled ?? true },
  );

  // Flatten pages into a single array of memos
  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) || [], [data]);

  // Apply custom sorting if provided, otherwise use memos directly
  const sortedMemoList = useMemo(() => (props.listSort ? props.listSort(memos) : memos), [memos, props.listSort]);
  const enablePinnedSection = props.collapsiblePinned === true;
  const pinnedStorageKey = "memos.ui.pinsCollapsed";

  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(() => {
    if (!enablePinnedSection) return false;
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(pinnedStorageKey) === "true";
  });

  const pinnedMemos = useMemo(() => {
    if (!enablePinnedSection) return [];
    return sortedMemoList.filter((memo) => memo.pinned);
  }, [enablePinnedSection, sortedMemoList]);

  const unpinnedMemos = useMemo(() => {
    if (!enablePinnedSection) return sortedMemoList;
    return sortedMemoList.filter((memo) => !memo.pinned);
  }, [enablePinnedSection, sortedMemoList]);

  useEffect(() => {
    if (!enablePinnedSection || typeof window === "undefined") return;
    window.localStorage.setItem(pinnedStorageKey, String(isPinnedCollapsed));
  }, [enablePinnedSection, isPinnedCollapsed]);

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

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      {/* Show skeleton loader during initial load */}
      {isLoading ? (
        <Skeleton showCreator={props.showCreator} count={4} />
      ) : (
        <>
          {(() => {
            const hasPinned = pinnedMemos.length > 0;
            const pinnedToggle = enablePinnedSection && hasPinned && (
              <div className="w-full mt-1 mb-2 flex items-center gap-3 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setIsPinnedCollapsed((prev) => !prev)}
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                  aria-expanded={!isPinnedCollapsed}
                >
                  {isPinnedCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  <span className="font-medium">
                    {t("common.pinned")} ({pinnedMemos.length})
                  </span>
                  <span className="text-xs opacity-70">{isPinnedCollapsed ? t("common.expand") : t("common.collapse")}</span>
                </button>
                <div className="h-px flex-1 bg-border/60" aria-hidden="true" />
              </div>
            );

            const prefixElement = (
              <>
                {showMemoEditor ? (
                  <MemoEditor className="mb-2" cacheKey="home-memo-editor" placeholder={t("editor.any-thoughts")} />
                ) : undefined}
                <MemoFilters />
                {pinnedToggle}
              </>
            );

            if (!enablePinnedSection) {
              return <MasonryView memoList={sortedMemoList} renderer={props.renderer} prefixElement={prefixElement} listMode={layout === "LIST"} />;
            }

            if (layout === "LIST") {
              const listMemoList = isPinnedCollapsed ? unpinnedMemos : sortedMemoList;
              const lastPinnedName = !isPinnedCollapsed && hasPinned ? pinnedMemos[pinnedMemos.length - 1]?.name : undefined;
              const listRenderer = lastPinnedName
                ? (memo: Memo, context?: MemoRenderContext) => (
                    <>
                      {props.renderer(memo, context)}
                      {memo.name === lastPinnedName && (
                        <div className="w-full max-w-2xl mx-auto my-2 h-px bg-border/60" aria-hidden="true" />
                      )}
                    </>
                  )
                : props.renderer;

              return <MasonryView memoList={listMemoList} renderer={listRenderer} prefixElement={prefixElement} listMode />;
            }
            return (
              <>
                <MasonryView
                  memoList={isPinnedCollapsed ? [] : pinnedMemos}
                  renderer={props.renderer}
                  prefixElement={prefixElement}
                  listMode={layout === "LIST"}
                />
                {hasPinned && !isPinnedCollapsed && <div className="w-full max-w-2xl mx-auto my-2 h-px bg-border/60" aria-hidden="true" />}
                <div className={hasPinned ? "mt-2" : ""}>
                  <MasonryView memoList={unpinnedMemos} renderer={props.renderer} listMode={layout === "LIST"} />
                </div>
              </>
            );
          })()}

          {/* Loading indicator for pagination */}
          {isFetchingNextPage && <Skeleton showCreator={props.showCreator} count={2} />}

          {/* Empty state or back-to-top button */}
          {!isFetchingNextPage && (
            <>
              {!hasNextPage && sortedMemoList.length === 0 ? (
                <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-2 text-muted-foreground">{t("message.no-data")}</p>
                </div>
              ) : (
                <div className="w-full opacity-70 flex flex-row justify-center items-center my-4">
                  <BackToTop />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
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
