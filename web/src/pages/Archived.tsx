import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ArchivedMemo from "@/components/ArchivedMemo";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import { memoServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const t = useTranslate();
  const loadingState = useLoading();
  const [archivedMemos, setArchivedMemos] = useState<Memo[]>([]);

  useEffect(() => {
    memoServiceClient
      .listMemos({
        filter: "row_status == 'ARCHIVED'",
      })
      .then(({ memos }) => {
        setArchivedMemos(memos);
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
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
              <ArchivedMemo key={`${memo.id}-${memo.updateTime}`} memo={memo} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Archived;
