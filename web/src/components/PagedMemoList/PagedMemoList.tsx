import { Button } from "@usememos/mui";
import { ArrowUpIcon, LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { Routes } from "@/router";
import { memoStore, viewStore } from "@/store/v2";
import { Direction, State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";
import MasonryView from "../MasonryView";
import MemoEditor from "../MemoEditor";

interface Props {
  renderer: (memo: Memo) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  owner?: string;
  state?: State;
  direction?: Direction;
  filter?: string;
  oldFilter?: string;
  pageSize?: number;
}

const PagedMemoList = observer((props: Props) => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();

  // Simplified state management - separate state variables for clarity
  const [isRequesting, setIsRequesting] = useState(true);
  const [nextPageToken, setNextPageToken] = useState("");

  // Ref to manage auto-fetch timeout to prevent memory leaks
  const autoFetchTimeoutRef = useRef<number | null>(null);

  // Apply custom sorting if provided, otherwise use store memos directly
  const sortedMemoList = props.listSort ? props.listSort(memoStore.state.memos) : memoStore.state.memos;

  // Show memo editor only on the root route
  const showMemoEditor = Boolean(matchPath(Routes.ROOT, window.location.pathname));

  // Fetch more memos with pagination support
  const fetchMoreMemos = async (pageToken: string) => {
    setIsRequesting(true);

    try {
      const response = await memoStore.fetchMemos({
        parent: props.owner || "",
        state: props.state || State.NORMAL,
        direction: props.direction || Direction.DESC,
        filter: props.filter || "",
        oldFilter: props.oldFilter || "",
        pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
        pageToken,
      });

      setNextPageToken(response?.nextPageToken || "");
    } finally {
      setIsRequesting(false);
    }
  };

  // Helper function to check if page has enough content to be scrollable
  const isPageScrollable = () => {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return documentHeight > window.innerHeight + 100; // 100px buffer for safe measure
  };

  // Auto-fetch more content if page isn't scrollable and more data is available
  const checkAndFetchIfNeeded = useCallback(async () => {
    // Clear any pending auto-fetch timeout
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }

    // Wait for DOM to update before checking scrollability
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Only fetch if: page isn't scrollable, we have more data, not currently loading, and have memos
    const shouldFetch = !isPageScrollable() && nextPageToken && !isRequesting && sortedMemoList.length > 0;

    if (shouldFetch) {
      await fetchMoreMemos(nextPageToken);

      // Schedule another check with delay to prevent rapid successive calls
      autoFetchTimeoutRef.current = window.setTimeout(() => {
        checkAndFetchIfNeeded();
      }, 500);
    }
  }, [nextPageToken, isRequesting, sortedMemoList.length]);

  // Refresh the entire memo list from the beginning
  const refreshList = async () => {
    memoStore.state.updateStateId();
    setNextPageToken("");
    await fetchMoreMemos("");
  };

  // Initial load and reload when props change
  useEffect(() => {
    refreshList();
  }, [props.owner, props.state, props.direction, props.filter, props.oldFilter, props.pageSize]);

  // Auto-fetch more content when list changes and page isn't full
  useEffect(() => {
    if (!isRequesting && sortedMemoList.length > 0) {
      checkAndFetchIfNeeded();
    }
  }, [sortedMemoList.length, isRequesting, nextPageToken, checkAndFetchIfNeeded]);

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, []);

  // Infinite scroll: fetch more when user scrolls near bottom
  useEffect(() => {
    if (!nextPageToken) return;

    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isRequesting) {
        fetchMoreMemos(nextPageToken);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [nextPageToken, isRequesting]);

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      <MasonryView
        memoList={sortedMemoList}
        renderer={props.renderer}
        prefixElement={showMemoEditor ? <MemoEditor className="mb-2" cacheKey="home-memo-editor" /> : undefined}
        listMode={viewStore.state.layout === "LIST"}
      />

      {/* Loading indicator */}
      {isRequesting && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-zinc-500" />
        </div>
      )}

      {/* Empty state or back-to-top button */}
      {!isRequesting && (
        <>
          {!nextPageToken && sortedMemoList.length === 0 ? (
            <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
              <Empty />
              <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
            </div>
          ) : (
            <div className="w-full opacity-70 flex flex-row justify-center items-center my-4">
              <BackToTop />
            </div>
          )}
        </>
      )}
    </div>
  );

  if (md) {
    return children;
  }

  return (
    <PullToRefresh
      onRefresh={() => refreshList()}
      pullingContent={
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="opacity-60" />
        </div>
      }
      refreshingContent={
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin" />
        </div>
      }
    >
      {children}
    </PullToRefresh>
  );
});

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
    <Button variant="plain" onClick={scrollToTop}>
      {t("router.back-to-top")}
      <ArrowUpIcon className="ml-1 w-4 h-auto" />
    </Button>
  );
};

export default PagedMemoList;
