import { Tooltip } from "@mui/joy";
import { ClientError } from "nice-grpc-web";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { showCommonDialog } from "@/components/Dialog/CommonDialog";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoContent from "@/components/MemoContent";
import MobileHeader from "@/components/MobileHeader";
import { memoServiceClient } from "@/grpcweb";
import { getDateTimeString } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v2/common";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";

const Archived = () => {
  const t = useTranslate();
  const loadingState = useLoading();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const [archivedMemos, setArchivedMemos] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const filters = [`creator == "${user.name}"`, "row_status == 'ARCHIVED'"];
        const { memos } = await memoServiceClient.listMemos({
          filter: filters.join(" && "),
        });
        setArchivedMemos(memos);
      } catch (error: unknown) {
        toast.error((error as ClientError).details);
      }
      loadingState.setFinish();
    })();
  }, []);

  const handleDeleteMemoClick = async (memo: Memo) => {
    showCommonDialog({
      title: t("memo.delete-memo"),
      content: t("memo.delete-confirm"),
      style: "danger",
      dialogName: "delete-memo-dialog",
      onConfirm: async () => {
        await memoStore.deleteMemo(memo.id);
        setArchivedMemos((prev) => prev.filter((m) => m.id !== memo.id));
      },
    });
  };

  const handleRestoreMemoClick = async (memo: Memo) => {
    try {
      await memoStore.updateMemo(
        {
          id: memo.id,
          rowStatus: RowStatus.ACTIVE,
        },
        ["row_status"]
      );
      setArchivedMemos((prev) => prev.filter((m) => m.id !== memo.id));
      toast(t("message.restored-successfully"));
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as ClientError).details);
    }
  };

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
              <div
                key={memo.id}
                className="relative flex flex-col justify-start items-start w-full p-4 pt-3 mb-2 bg-white dark:bg-zinc-800 rounded-lg"
              >
                <div className="w-full mb-1 flex flex-row justify-between items-center">
                  <div className="w-full max-w-[calc(100%-20px)] flex flex-row justify-start items-center mr-1">
                    <span className="text-sm text-gray-400 select-none">{getDateTimeString(memo.updateTime)}</span>
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
                <MemoContent nodes={memo.nodes} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Archived;
