import { Button } from "@usememos/mui";
import { ArrowDownIcon, ArrowUpIcon, LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { matchPath } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { Routes } from "@/router";
import { useMemoFilterStore, useMemoList, useMemoStore } from "@/store/v1";
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
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const memoFilterStore = useMemoFilterStore();
  const [state, setState] = useState<LocalState>({
    isRequesting: true, // Initial request
    nextPageToken: "",
  });
  const sortedMemoList = props.listSort ? props.listSort(memoList.value) : memoList.value;
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

  const refreshList = async () => {
    memoList.reset();
    setState((state) => ({ ...state, nextPageToken: "" }));
    await fetchMoreMemos("");
  };

  useEffect(() => {
    refreshList();
  }, [props.owner, props.state, props.direction, props.filter, props.oldFilter, props.pageSize]);

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      <MasonryView
        memoList={sortedMemoList}
        renderer={props.renderer}
        prefixElement={showMemoEditor ? <MemoEditor className="mb-2" cacheKey="home-memo-editor" /> : undefined}
        listMode={!memoFilterStore.masonry}
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
            <div className="w-full flex flex-row justify-center items-center my-4">
              {state.nextPageToken && (
                <Button variant="plain" onClick={() => fetchMoreMemos(state.nextPageToken)}>
                  {t("memo.load-more")}
                  <ArrowDownIcon className="ml-1 w-4 h-auto" />
                </Button>
              )}
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
