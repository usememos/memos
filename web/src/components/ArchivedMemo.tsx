import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useMemoStore } from "@/store/module";
import { getDateTimeString } from "@/helpers/datetime";
import useToggle from "@/hooks/useToggle";
import Tooltip from "./kit/Tooltip";
import Icon from "./Icon";
import MemoContent from "./MemoContent";
import MemoResourceListView from "./MemoResourceListView";
import "@/less/memo.less";

interface Props {
  memo: Memo;
}

const ArchivedMemo: React.FC<Props> = (props: Props) => {
  const { memo } = props;
  const { t } = useTranslation();
  const memoStore = useMemoStore();
  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);

  const handleDeleteMemoClick = async () => {
    if (showConfirmDeleteBtn) {
      try {
        await memoStore.deleteMemoById(memo.id);
      } catch (error: any) {
        console.error(error);
        toast.error(error.response.data.message);
      }
    } else {
      toggleConfirmDeleteBtn();
    }
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

  const handleMouseLeaveMemoWrapper = () => {
    if (showConfirmDeleteBtn) {
      toggleConfirmDeleteBtn(false);
    }
  };

  return (
    <div className={`memo-wrapper archived ${"memos-" + memo.id}`} onMouseLeave={handleMouseLeaveMemoWrapper}>
      <div className="memo-top-wrapper">
        <div className="status-text-container">
          <span className="time-text">{getDateTimeString(memo.updatedTs)}</span>
        </div>
        <div className="flex flex-row justify-end items-center gap-x-2">
          <Tooltip title={t("common.restore")} side="top">
            <button onClick={handleRestoreMemoClick}>
              <Icon.ArchiveRestore className="w-4 h-auto cursor-pointer text-gray-500 dark:text-gray-400" />
            </button>
          </Tooltip>
          <Tooltip title={t("common.delete")} side="top">
            <button
              onClick={handleDeleteMemoClick}
              className={`text-gray-500 dark:text-gray-400 ${showConfirmDeleteBtn ? "text-red-600" : ""}`}
            >
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
