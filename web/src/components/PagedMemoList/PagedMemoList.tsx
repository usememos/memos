import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArchiveIcon, ArrowUpIcon, BookmarkPlusIcon, TrashIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { matchPath } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { userServiceClient } from "@/connect";
import { MemoSelectionContext, useMemoSelection } from "@/contexts/MemoSelectionContext";
import { useView } from "@/contexts/ViewContext";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { useDeleteMemo, useInfiniteMemos, useUpdateMemo } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMemoNames, setSelectedMemoNames] = useState<Set<string>>(() => new Set());
  const [selectionBarContainer, setSelectionBarContainer] = useState<HTMLElement | null>(null);

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

  const selectionContextValue = useMemo(() => {
    const selectedCount = selectedMemoNames.size;
    return {
      isSelectionMode,
      selectedMemoNames,
      selectedCount,
      isSelected: (name: string) => selectedMemoNames.has(name),
      toggleMemoSelection: (name: string) => {
        setSelectedMemoNames((prev) => {
          const next = new Set(prev);
          if (next.has(name)) {
            next.delete(name);
          } else {
            next.add(name);
          }
          return next;
        });
      },
      enterSelectionMode: (name?: string) => {
        setIsSelectionMode(true);
        if (name) {
          setSelectedMemoNames((prev) => {
            if (prev.has(name)) return prev;
            const next = new Set(prev);
            next.add(name);
            return next;
          });
        }
      },
      exitSelectionMode: () => {
        setIsSelectionMode(false);
        setSelectedMemoNames(new Set());
      },
    };
  }, [isSelectionMode, selectedMemoNames]);

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

  useEffect(() => {
    setSelectionBarContainer(document.getElementById("memo-selection-actions"));
  }, []);

  useEffect(() => {
    if (!isSelectionMode || selectedMemoNames.size === 0) return;
    const memoNameSet = new Set(sortedMemoList.map((memo) => memo.name));
    setSelectedMemoNames((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const name of prev) {
        if (memoNameSet.has(name)) {
          next.add(name);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isSelectionMode, selectedMemoNames, sortedMemoList]);

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
      <MemoSelectionBar memoList={sortedMemoList} container={selectionBarContainer} />
      {/* Show skeleton loader during initial load */}
      {isLoading ? (
        <Skeleton showCreator={props.showCreator} count={4} />
      ) : (
        <>
          <MasonryView
            memoList={sortedMemoList}
            renderer={props.renderer}
            prefixElement={
              <>
                {showMemoEditor ? (
                  <MemoEditor className="mb-2" cacheKey="home-memo-editor" placeholder={t("editor.any-thoughts")} />
                ) : undefined}
                <MemoFilters />
              </>
            }
            listMode={layout === "LIST"}
          />

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

  return <MemoSelectionContext.Provider value={selectionContextValue}>{children}</MemoSelectionContext.Provider>;
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

const MemoSelectionBar = ({ memoList, container }: { memoList: Memo[]; container: HTMLElement | null }) => {
  const t = useTranslate();
  const selection = useMemoSelection();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const { mutateAsync: deleteMemo } = useDeleteMemo();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!selection || !selection.isSelectionMode || !container) {
    return null;
  }

  const selectedMemos = memoList.filter((memo) => selection.selectedMemoNames.has(memo.name));
  const selectedCount = selection.selectedCount;

  const handleBulkPin = async () => {
    if (selectedCount === 0) return;
    const targets = selectedMemos.filter((memo) => !memo.pinned);
    if (targets.length === 0) return;
    try {
      await Promise.all(
        targets.map((memo) => updateMemo({ update: { name: memo.name, pinned: true }, updateMask: ["pinned"] })),
      );
      toast.success(t("message.pinned-selected-memos"));
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Bulk pin memos",
        fallbackMessage: "Failed to pin selected memos",
      });
    }
  };

  const handleBulkArchive = async () => {
    if (selectedCount === 0) return;
    const targets = selectedMemos.filter((memo) => memo.state !== State.ARCHIVED);
    if (targets.length === 0) return;
    try {
      await Promise.all(
        targets.map((memo) => updateMemo({ update: { name: memo.name, state: State.ARCHIVED }, updateMask: ["state"] })),
      );
      toast.success(t("message.archived-selected-memos"));
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Bulk archive memos",
        fallbackMessage: "Failed to archive selected memos",
      });
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedCount === 0) return;
    try {
      await Promise.all(selectedMemos.map((memo) => deleteMemo(memo.name)));
      toast.success(t("message.deleted-selected-memos"));
      selection.exitSelectionMode();
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Bulk delete memos",
        fallbackMessage: "Failed to delete selected memos",
      });
    }
  };

  return createPortal(
    <div className="flex flex-row justify-end items-center gap-2 rounded-md border border-border/60 bg-accent/40 px-2 py-1">
      <span className="text-xs text-muted-foreground">{t("memo.selected-count", { count: selectedCount })}</span>
      <div className="flex flex-row justify-end items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedCount === 0}
          onClick={handleBulkPin}
          aria-label={t("common.pin")}
        >
          <BookmarkPlusIcon className="w-4 h-auto" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedCount === 0}
          onClick={handleBulkArchive}
          aria-label={t("common.archive")}
        >
          <ArchiveIcon className="w-4 h-auto" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedCount === 0}
          onClick={() => setDeleteDialogOpen(true)}
          aria-label={t("common.delete")}
        >
          <TrashIcon className="w-4 h-auto" />
        </Button>
        <Button variant="ghost" size="icon" onClick={selection.exitSelectionMode} aria-label={t("common.cancel")}>
          <XIcon className="w-4 h-auto" />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("memo.delete-selected-confirm")}
        confirmLabel={t("common.delete")}
        description={t("memo.delete-selected-confirm-description")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmBulkDelete}
        confirmVariant="destructive"
      />
    </div>,
    container,
  );
};
