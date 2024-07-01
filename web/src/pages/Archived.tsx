import { Button, Tooltip } from "@mui/joy";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoContent from "@/components/MemoContent";
import MobileHeader from "@/components/MobileHeader";
import SearchBar from "@/components/SearchBar";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useFilterWithUrlParams from "@/hooks/useFilterWithUrlParams";
import { useMemoList, useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [isRequesting, setIsRequesting] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string>("");
  const { tag: tagQuery, text: textQuery } = useFilterWithUrlParams();
  const sortedMemos = memoList.value
    .filter((memo) => memo.rowStatus === RowStatus.ARCHIVED)
    .sort((a, b) => getTimeStampByDate(b.displayTime) - getTimeStampByDate(a.displayTime));

  useEffect(() => {
    memoList.reset();
    fetchMemos("");
  }, [tagQuery, textQuery]);

  const fetchMemos = async (nextPageToken: string) => {
    setIsRequesting(true);
    const filters = [`creator == "${user.name}"`, `row_status == "ARCHIVED"`];
    const contentSearch: string[] = [];
    if (textQuery) {
      contentSearch.push(JSON.stringify(textQuery));
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagQuery) {
      filters.push(`tag == "${tagQuery}"`);
    }
    const response = await memoStore.fetchMemos({
      pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
      filter: filters.join(" && "),
      pageToken: nextPageToken,
    });
    setIsRequesting(false);
    setNextPageToken(response.nextPageToken);
  };

  const handleDeleteMemoClick = async (memo: Memo) => {
    const confirmed = window.confirm(t("memo.delete-confirm"));
    if (confirmed) {
      await memoStore.deleteMemo(memo.name);
    }
  };

  const handleRestoreMemoClick = async (memo: Memo) => {
    try {
      await memoStore.updateMemo(
        {
          name: memo.name,
          rowStatus: RowStatus.ACTIVE,
        },
        ["row_status"],
      );
      toast(t("message.restored-successfully"));
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as ClientError).details);
    }
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full flex flex-col justify-start items-start">
          <div className="w-full flex flex-row justify-between items-center mb-2">
            <div className="flex flex-row justify-start items-center gap-1">
              <Icon.Archive className="w-5 h-auto opacity-70 shrink-0" />
              <span>{t("common.archived")}</span>
            </div>
            <div className="w-44">
              <SearchBar />
            </div>
          </div>
          {sortedMemos.map((memo) => (
            <div
              key={memo.name}
              className="relative flex flex-col justify-start items-start w-full p-4 pt-3 mb-2 bg-white dark:bg-zinc-800 rounded-lg"
            >
              <div className="w-full mb-1 flex flex-row justify-between items-center">
                <div className="w-full max-w-[calc(100%-20px)] flex flex-row justify-start items-center mr-1">
                  <div className="text-sm leading-6 text-gray-400 select-none">
                    <relative-time datetime={memo.displayTime?.toISOString()} tense="past"></relative-time>
                  </div>
                </div>
                <div className="flex flex-row justify-end items-center gap-x-2">
                  <Tooltip title={t("common.restore")} placement="top">
                    <button onClick={() => handleRestoreMemoClick(memo)}>
                      <Icon.ArchiveRestore className="w-4 h-auto cursor-pointer text-gray-500 dark:text-gray-400" />
                    </button>
                  </Tooltip>
                  <Tooltip title={t("common.delete")} placement="top">
                    <button onClick={() => handleDeleteMemoClick(memo)} className="text-gray-500 dark:text-gray-400">
                      <Icon.Trash className="w-4 h-auto cursor-pointer" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <MemoContent key={`${memo.name}-${memo.displayTime}`} memoName={memo.name} nodes={memo.nodes} readonly={true} />
            </div>
          ))}
          {isRequesting ? (
            <div className="flex flex-row justify-center items-center w-full my-4 text-gray-400">
              <Icon.Loader className="w-4 h-auto animate-spin mr-1" />
              <p className="text-sm italic">{t("memo.fetching-data")}</p>
            </div>
          ) : !nextPageToken ? (
            sortedMemos.length === 0 && (
              <div className="w-full mt-16 mb-8 flex flex-col justify-center items-center italic">
                <Empty />
                <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
              </div>
            )
          ) : (
            <div className="w-full flex flex-row justify-center items-center my-4">
              <Button variant="plain" endDecorator={<Icon.ArrowDown className="w-5 h-auto" />} onClick={() => fetchMemos(nextPageToken)}>
                {t("memo.fetch-more")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Archived;
