import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ArchivedMemo from "@/components/ArchivedMemo";
import Empty from "@/components/Empty";
import MemoFilter from "@/components/MemoFilter";
import MobileHeader from "@/components/MobileHeader";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useFilterStore, useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import "@/less/archived.less";

const Archived = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const loadingState = useLoading();
  const [archivedMemos, setArchivedMemos] = useState<Memo[]>([]);
  const memos = memoStore.state.memos;
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const { text: textQuery } = filter;

  useEffect(() => {
    if (!user) {
      window.location.href = "/auth";
    }
  }, []);

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
    <section className="w-full min-h-full flex flex-col md:flex-row justify-start items-start px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="archived-memo-page">
        <MemoFilter />
        {loadingState.isLoading ? (
          <div className="tip-text-container">
            <p className="tip-text">{t("memo.fetching-data")}</p>
          </div>
        ) : archivedMemos.length === 0 ? (
          <div className="w-full mt-16 mb-8 flex flex-col justify-center items-center italic">
            <Empty />
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
          </div>
        ) : (
          <div className="archived-memos-container">
            {archivedMemos.map((memo) => (
              <ArchivedMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Archived;
