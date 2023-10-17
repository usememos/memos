import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ArchivedMemo from "@/components/ArchivedMemo";
import Empty from "@/components/Empty";
import MemoFilter from "@/components/MemoFilter";
import MobileHeader from "@/components/MobileHeader";
import useLoading from "@/hooks/useLoading";
import { useFilterStore, useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const t = useTranslate();
  const memoStore = useMemoStore();
  const loadingState = useLoading();
  const [archivedMemos, setArchivedMemos] = useState<Memo[]>([]);
  const memos = memoStore.state.memos;
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const { text: textQuery } = filter;

  useEffect(() => {
    memoStore
      .fetchArchivedMemos()
      .then((result) => {
        const filteredMemos = textQuery ? result.filter((memo) => memo.content.toLowerCase().includes(textQuery.toLowerCase())) : result;
        setArchivedMemos(filteredMemos);
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, [memos, textQuery]);

  return (
    <section className="@container w-full max-w-3xl min-h-full flex flex-col justify-start items-start px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <MemoFilter />
      {loadingState.isLoading ? (
        <div className="w-full h-32 flex flex-col justify-center items-center">
          <p className="opacity-70">{t("memo.fetching-data")}</p>
        </div>
      ) : archivedMemos.length === 0 ? (
        <div className="w-full mt-16 mb-8 flex flex-col justify-center items-center italic">
          <Empty />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
        </div>
      ) : (
        <div className="w-full flex flex-col justify-start items-start">
          {archivedMemos.map((memo) => (
            <ArchivedMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
          ))}
        </div>
      )}
    </section>
  );
};

export default Archived;
