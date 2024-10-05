import { Button } from "@mui/joy";
import { ArrowDownIcon, LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
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
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [state, setState] = useState<State>({
    isRequesting: true, // Initial request
    nextPageToken: "",
  });
  const sortedMemoList = props.listSort ? props.listSort(memoList.value) : memoList.value;

  const setIsRequesting = (isRequesting: boolean) => {
    setState((state) => ({ ...state, isRequesting }));
  };

  const fetchMoreMemos = async (nextPageToken: string) => {
    setIsRequesting(true);
    const response = await memoStore.fetchMemos({
      filter: props.filter || "",
      pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
      pageToken: nextPageToken,
    });
    setState(() => ({
      isRequesting: false,
      nextPageToken: response.nextPageToken,
    }));
  };

  useEffect(() => {
    memoList.reset();
    setState((state) => ({ ...state, nextPageToken: "" }));
    fetchMoreMemos("");
  }, [props.filter, props.pageSize]);

  return (
    <>
      {sortedMemoList.map((memo) => props.renderer(memo))}
      {state.isRequesting && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-zinc-500" />
        </div>
      )}
      {!state.isRequesting && state.nextPageToken && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <Button
            variant="plain"
            color="neutral"
            loading={state.isRequesting}
            endDecorator={<ArrowDownIcon className="w-4 h-auto" />}
            onClick={() => fetchMoreMemos(state.nextPageToken)}
          >
            {t("memo.load-more")}
          </Button>
        </div>
      )}
      {!state.isRequesting && !state.nextPageToken && sortedMemoList.length === 0 && (
        <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
          <Empty />
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
        </div>
      )}
    </>
  );
};

export default PagedMemoList;
