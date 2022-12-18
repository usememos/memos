import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoStore } from "../store/module";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/change-memo-created-ts-dialog.less";

interface Props extends DialogProps {
  memoId: MemoId;
}

const ChangeMemoCreatedTsDialog: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation();
  const { destroy, memoId } = props;
  const memoStore = useMemoStore();
  const [createdAt, setCreatedAt] = useState("");
  const maxDatetimeValue = dayjs().format("YYYY-MM-DDTHH:mm");

  useEffect(() => {
    memoStore.getMemoById(memoId).then((memo) => {
      if (memo) {
        const datetime = dayjs(memo.createdTs).format("YYYY-MM-DDTHH:mm");
        setCreatedAt(datetime);
      } else {
        toastHelper.error(t("message.memo-not-found"));
        destroy();
      }
    });
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
      toastHelper.error(t("message.invalid-created-datetime"));
      return;
    }

    try {
      await memoStore.patchMemo({
        id: memoId,
        createdTs,
      });
      toastHelper.info(t("message.memo-updated-datetime"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("message.change-memo-created-time")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="w-full bg-yellow-100 border border-yellow-400 rounded p-2 text-xs leading-4">
          THIS IS NOT A NORMAL BEHAVIOR. PLEASE MAKE SURE YOU REALLY NEED IT.
        </p>
        <input
          className="input-text mt-2"
          type="datetime-local"
          value={createdAt}
          max={maxDatetimeValue}
          onChange={handleDatetimeInputChange}
        />
        <div className="btns-container">
          <span className="btn-text" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </span>
          <span className="btn-primary" onClick={handleSaveBtnClick}>
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
      dialogName: "change-memo-created-ts-dialog",
    },
    ChangeMemoCreatedTsDialog,
    {
      memoId,
    }
  );
}

export default showChangeMemoCreatedTsDialog;
