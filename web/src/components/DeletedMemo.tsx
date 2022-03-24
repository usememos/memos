import { IMAGE_URL_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import useToggle from "../hooks/useToggle";
import { memoService } from "../services";
import Only from "./common/OnlyWhen";
import Image from "./Image";
import toastHelper from "./Toast";
import { formatMemoContent } from "./Memo";
import "../less/memo.less";

interface Props {
  memo: Model.Memo;
  handleDeletedMemoAction: (memoId: string) => void;
}

const DeletedMemo: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo, handleDeletedMemoAction } = props;
  const memo: FormattedMemo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.createdAt),
    deletedAtStr: utils.getDateTimeString(propsMemo.updatedAt ?? Date.now()),
  };
  const [showConfirmDeleteBtn, toggleConfirmDeleteBtn] = useToggle(false);
  const imageUrls = Array.from(memo.content.match(IMAGE_URL_REG) ?? []);

  const handleDeleteMemoClick = async () => {
    if (showConfirmDeleteBtn) {
      try {
        await memoService.deleteMemoById(memo.id);
        handleDeletedMemoAction(memo.id);
      } catch (error: any) {
        toastHelper.error(error.message);
      }
    } else {
      toggleConfirmDeleteBtn();
    }
  };

  const handleRestoreMemoClick = async () => {
    try {
      await memoService.restoreMemoById(memo.id);
      handleDeletedMemoAction(memo.id);
      toastHelper.info("Restored successfully");
    } catch (error: any) {
      toastHelper.error(error.message);
    }
  };

  const handleMouseLeaveMemoWrapper = () => {
    if (showConfirmDeleteBtn) {
      toggleConfirmDeleteBtn(false);
    }
  };

  return (
    <div className={`memo-wrapper deleted-memo ${"memos-" + memo.id}`} onMouseLeave={handleMouseLeaveMemoWrapper}>
      <div className="memo-top-wrapper">
        <span className="time-text">Deleted at {memo.deletedAtStr}</span>
        <div className="btns-container">
          <span className="btn restore-btn" onClick={handleRestoreMemoClick}>
            Restore
          </span>
          <span className={`btn delete-btn ${showConfirmDeleteBtn ? "final-confirm" : ""}`} onClick={handleDeleteMemoClick}>
            {showConfirmDeleteBtn ? "Delete!" : "Delete"}
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

export default DeletedMemo;
