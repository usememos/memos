import { Button } from "@usememos/mui";
import { ArrowDownIcon, ArrowUpIcon, LoaderIcon, SlashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useMemoList, useMemoStore } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";

interface Props {
  renderer: (memo: Memo) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  filter?: string;
  pageSize?: number;
}

interface State {
  isRequesting: boolean;
  nextPageToken: string;
}

const PagedMemoList = (props: Props) => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [state, setState] = useState<State>({
    isRequesting: true, // Initial request
    nextPageToken: "",
  });
  const sortedMemoList = props.listSort ? props.listSort(memoList.value) : memoList.value;

  const fetchMoreMemos = async (nextPageToken: string) => {
    setState((state) => ({ ...state, isRequesting: true }));
    const response = await memoStore.fetchMemos({
      filter: props.filter || "",
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
    fetchMoreMemos("");
  };

  useEffect(() => {
    refreshList();
  }, [props.filter, props.pageSize]);

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      {sortedMemoList.map((memo) => props.renderer(memo))}
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
                <>
                  <Button variant="plain" onClick={() => fetchMoreMemos(state.nextPageToken)}>
                    {t("memo.load-more")}
                    <ArrowDownIcon className="ml-1 w-4 h-auto" />
                  </Button>
                  <SlashIcon className="mx-1 w-4 h-auto opacity-40" />
                </>
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
};

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
