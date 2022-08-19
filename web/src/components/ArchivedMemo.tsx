import { IMAGE_URL_REG } from "../helpers/consts";
import * as utils from "../helpers/utils";
import useI18n from "../hooks/useI18n";
import useToggle from "../hooks/useToggle";
import { memoService } from "../services";
import { formatMemoContent } from "../helpers/marked";
import Only from "./common/OnlyWhen";
import Image from "./Image";
import toastHelper from "./Toast";
import "../less/memo.less";

interface Props {
  memo: Memo;
}

const ArchivedMemo: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo } = props;
  const memo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdTs),
    archivedAtStr: utils.getDateTimeString(propsMemo.updatedTs ?? Date.now()),
  };
  const { t } = useI18n();
  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []).map((s) => s.replace(IMAGE_URL_REG, "$1"));

  const handleDeleteMemoClick = async () => {
    if (showConfirmDeleteBtn) {
      try {
        await memoService.deleteMemoById(memo.id);
        await memoService.fetchAllMemos();
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
      await memoService.fetchAllMemos();
      toastHelper.info("Restored successfully");
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
        <span className="time-text">Archived at {memo.archivedAtStr}</span>
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
      <div className="memo-content-text" dangerouslySetInnerHTML={{ __html: formatMemoContent(memo.content) }}></div>
      <Only when={imageUrls.length > 0}>
        <div className="images-wrapper">
          {imageUrls.map((imgUrl, idx) => (
            <Image className="memo-img" key={idx} imgUrl={imgUrl} />
          ))}
        </div>
      </Only>
    </div>
  );
};

export default ArchivedMemo;
