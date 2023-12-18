import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ArchivedMemo from "@/components/ArchivedMemo";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import useLoading from "@/hooks/useLoading";
import { useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const t = useTranslate();
  const memoStore = useMemoStore();
  const loadingState = useLoading();
  const [archivedMemos, setArchivedMemos] = useState<Memo[]>([]);
  const memos = memoStore.state.memos;

  useEffect(() => {
    memoStore
      .fetchArchivedMemos()
      .then((result) => {
        setArchivedMemos(result);
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, [memos]);

  return (
    <section className="@container w-full max-w-3xl min-h-full flex flex-col justify-start items-start px-4 sm:px-2 sm:pt-4 pb-8">
      <MobileHeader />
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
