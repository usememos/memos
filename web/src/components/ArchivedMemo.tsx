import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useMemoStore } from "@/store/module";
import { getDateTimeString } from "@/helpers/datetime";
import useToggle from "@/hooks/useToggle";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
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
        <span className="time-text">
          {t("memo.archived-at")} {getDateTimeString(memo.updatedTs)}
        </span>
        <div className="btns-container">
          <span className="btn-text" onClick={handleRestoreMemoClick}>
            {t("common.restore")}
          </span>
          <span className={`btn-text ${showConfirmDeleteBtn ? "final-confirm" : ""}`} onClick={handleDeleteMemoClick}>
            {t("common.delete")}
            {showConfirmDeleteBtn ? "!" : ""}
          </span>
        </div>
      </div>
      <MemoContent content={memo.content} />
      <MemoResources resourceList={memo.resourceList} />
    </div>
  );
};

export default ArchivedMemo;
