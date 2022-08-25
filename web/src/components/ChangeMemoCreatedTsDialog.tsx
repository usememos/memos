import { useEffect, useState } from "react";
import dayjs from "dayjs";
import useI18n from "../hooks/useI18n";
import { memoService } from "../services";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/change-memo-created-ts-dialog.less";

interface Props extends DialogProps {
  memoId: MemoId;
}

const ChangeMemoCreatedTsDialog: React.FC<Props> = (props: Props) => {
  const { t } = useI18n();
  const { destroy, memoId } = props;
  const [createdAt, setCreatedAt] = useState("");
  const maxDatetimeValue = dayjs().format("YYYY-MM-DDTHH:mm");

  useEffect(() => {
    const memo = memoService.getMemoById(memoId);
    if (memo) {
      const datetime = dayjs(memo.createdTs).format("YYYY-MM-DDTHH:mm");
      setCreatedAt(datetime);
    } else {
      toastHelper.error("Memo not found.");
      destroy();
    }
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDatetimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const datetime = e.target.value as string;
    setCreatedAt(datetime);
  };

  const handleSaveBtnClick = async () => {
    const nowTs = dayjs().unix();
    const createdTs = dayjs(createdAt).unix();

    if (createdTs > nowTs) {
      toastHelper.error("Invalid created datetime.");
      return;
    }

    try {
      await memoService.patchMemo({
        id: memoId,
        createdTs,
      });
      toastHelper.info("Memo created datetime changed.");
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Change memo created time</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <label className="form-label input-form-label">
          <input type="datetime-local" value={createdAt} max={maxDatetimeValue} onChange={handleDatetimeInputChange} />
        </label>
        <div className="btns-container">
          <span className="btn cancel-btn" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </span>
          <span className="btn confirm-btn" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </span>
        </div>
      </div>
    </>
  );
};

function showChangeMemoCreatedTsDialog(memoId: MemoId) {
  generateDialog(
    {
      className: "change-memo-created-ts-dialog",
    },
    ChangeMemoCreatedTsDialog,
    {
      memoId,
    }
  );
}

export default showChangeMemoCreatedTsDialog;
