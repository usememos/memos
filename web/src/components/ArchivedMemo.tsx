import { Tooltip } from "@mui/joy";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useMemoStore } from "@/store/module";
import { getDateTimeString } from "@/helpers/datetime";
import Icon from "./Icon";
import MemoContent from "./MemoContent";
import MemoResourceListView from "./MemoResourceListView";
import { showCommonDialog } from "./Dialog/CommonDialog";
import "@/less/memo.less";

interface Props {
  memo: Memo;
}

const ArchivedMemo: React.FC<Props> = (props: Props) => {
  const { memo } = props;
  const { t } = useTranslation();
  const memoStore = useMemoStore();

  const handleDeleteMemoClick = async () => {
    showCommonDialog({
      title: t("memo.delete-memo"),
      content: t("memo.delete-confirm"),
      style: "warning",
      dialogName: "delete-memo-dialog",
      onConfirm: async () => {
        await memoStore.deleteMemoById(memo.id);
      },
    });
  };

  const handleRestoreMemoClick = async () => {
    try {
      await memoStore.patchMemo({
        id: memo.id,
        rowStatus: "NORMAL",
      });
      await memoStore.fetchMemos();
      toast(t("message.restored-successfully"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  return (
    <div className={`memo-wrapper archived ${"memos-" + memo.id}`}>
      <div className="memo-top-wrapper">
        <div className="status-text-container">
          <span className="time-text">{getDateTimeString(memo.updatedTs)}</span>
        </div>
        <div className="flex flex-row justify-end items-center gap-x-2">
          <Tooltip title={t("common.restore")} placement="top">
            <button onClick={handleRestoreMemoClick}>
              <Icon.ArchiveRestore className="w-4 h-auto cursor-pointer text-gray-500 dark:text-gray-400" />
            </button>
          </Tooltip>
          <Tooltip title={t("common.delete")} placement="top">
            <button onClick={handleDeleteMemoClick} className="text-gray-500 dark:text-gray-400">
              <Icon.Trash className="w-4 h-auto cursor-pointer" />
            </button>
          </Tooltip>
        </div>
      </div>
      <MemoContent content={memo.content} />
      <MemoResourceListView resourceList={memo.resourceList} />
    </div>
  );
};

export default ArchivedMemo;
