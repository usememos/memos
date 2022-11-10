import { useTranslation } from "react-i18next";
import * as utils from "../helpers/utils";
import useToggle from "../hooks/useToggle";
import { memoService } from "../services";
import toastHelper from "./Toast";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
import "../less/memo.less";

interface Props {
  memo: Memo;
}

const ArchivedMemo: React.FC<Props> = (props: Props) => {
  const { memo } = props;
  const { t } = useTranslation();

  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);

  const handleDeleteMemoClick = async () => {
    if (showConfirmDeleteBtn) {
      try {
        await memoService.deleteMemoById(memo.id);
      } catch (error: any) {
        console.error(error);
        toastHelper.error(error.response.data.message);
      }
    } else {
      toggleConfirmDeleteBtn();
    }
  };

  const handleRestoreMemoClick = async () => {
    try {
      await memoService.patchMemo({
        id: memo.id,
        rowStatus: "NORMAL",
      });
      await memoService.fetchMemos();
      toastHelper.info(t("message.restored-successfully"));
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  const handleMouseLeaveMemoWrapper = () => {
    if (showConfirmDeleteBtn) {
      toggleConfirmDeleteBtn(false);
    }
  };

  return (
    <div className={`memo-wrapper archived-memo ${"memos-" + memo.id}`} onMouseLeave={handleMouseLeaveMemoWrapper}>
      <div className="memo-top-wrapper">
        <span className="time-text">
          {t("common.archived-at")} {utils.getDateTimeString(memo.updatedTs)}
        </span>
        <div className="btns-container">
          <span className="btn restore-btn" onClick={handleRestoreMemoClick}>
            {t("common.restore")}
          </span>
          <span className={`btn delete-btn ${showConfirmDeleteBtn ? "final-confirm" : ""}`} onClick={handleDeleteMemoClick}>
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
