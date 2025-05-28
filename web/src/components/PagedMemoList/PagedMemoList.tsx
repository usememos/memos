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

interface LocalState {
  isRequesting: boolean;
  nextPageToken: string;
}

const PagedMemoList = observer((props: Props) => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const [state, setState] = useState<LocalState>({
    isRequesting: true, // Initial request
    nextPageToken: "",
  });
  const checkTimeoutRef = useRef<number | null>(null);
  const sortedMemoList = props.listSort ? props.listSort(memoStore.state.memos) : memoStore.state.memos;
  const showMemoEditor = Boolean(matchPath(Routes.ROOT, window.location.pathname));

  const fetchMoreMemos = async (nextPageToken: string) => {
    setState((state) => ({ ...state, isRequesting: true }));
    const response = await memoStore.fetchMemos({
      parent: props.owner || "",
      state: props.state || State.NORMAL,
      direction: props.direction || Direction.DESC,
      filter: props.filter || "",
      oldFilter: props.oldFilter || "",
      pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
      pageToken: nextPageToken,
    });
    setState(() => ({
      isRequesting: false,
      nextPageToken: response?.nextPageToken || "",
    }));
  };

  // Check if content fills the viewport and fetch more if needed
  const checkAndFetchIfNeeded = useCallback(async () => {
    // Clear any pending checks
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Wait a bit for DOM to update after memo list changes
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check if page is scrollable using multiple methods for better reliability
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
    );

    const windowHeight = window.innerHeight;
    const isScrollable = documentHeight > windowHeight + 100; // 100px buffer

    // If not scrollable and we have more data to fetch and not currently fetching
    if (!isScrollable && state.nextPageToken && !state.isRequesting && sortedMemoList.length > 0) {
      await fetchMoreMemos(state.nextPageToken);
      // Schedule another check after a delay to prevent rapid successive calls
      checkTimeoutRef.current = window.setTimeout(() => {
        checkAndFetchIfNeeded();
      }, 500);
    }
  }, [state.nextPageToken, state.isRequesting, sortedMemoList.length]);

  const refreshList = async () => {
    memoStore.state.updateStateId();
    setState((state) => ({ ...state, nextPageToken: "" }));
    await fetchMoreMemos("");
  };

  useEffect(() => {
    refreshList();
  }, [props.owner, props.state, props.direction, props.filter, props.oldFilter, props.pageSize]);

  // Check if we need to fetch more data when content changes.
  useEffect(() => {
    if (!state.isRequesting && sortedMemoList.length > 0) {
      checkAndFetchIfNeeded();
    }
  }, [sortedMemoList.length, state.isRequesting, state.nextPageToken, checkAndFetchIfNeeded]);

  // Cleanup timeout on unmount.
  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state.nextPageToken) return;
    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !state.isRequesting) {
        fetchMoreMemos(state.nextPageToken);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [state.nextPageToken, state.isRequesting]);

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      <MasonryView
        memoList={sortedMemoList}
        renderer={props.renderer}
        prefixElement={showMemoEditor ? <MemoEditor className="mb-2" cacheKey="home-memo-editor" /> : undefined}
        listMode={viewStore.state.layout === "LIST"}
      />
      {state.isRequesting && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-zinc-500" />
        </div>
      )}
      {!state.isRequesting && (
        <>
          {!state.nextPageToken && sortedMemoList.length === 0 ? (
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

  // In case of md screen, we don't need pull to refresh.
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
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const shouldBeVisible = window.scrollY > 400;
      if (shouldBeVisible !== isVisible) {
        if (shouldBeVisible) {
          setShouldRender(true);
          setIsVisible(true);
        } else {
          setShouldRender(false);
          setIsVisible(false);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isVisible]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!shouldRender) {
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
