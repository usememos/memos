import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getNormalizedTimeString, getUnixTime } from "@/helpers/datetime";
import { useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

interface Props extends DialogProps {
  memoId: MemoId;
}

const ChangeMemoCreatedTsDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { destroy, memoId } = props;
  const memoStore = useMemoStore();
  const [createdAt, setCreatedAt] = useState("");
  const maxDatetimeValue = getNormalizedTimeString();

  useEffect(() => {
    memoStore.getMemoById(memoId).then((memo) => {
      if (memo) {
        const datetime = getNormalizedTimeString(memo.createdTs);
        setCreatedAt(datetime);
      } else {
        toast.error(t("message.memo-not-found"));
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
    const nowTs = getUnixTime();
    const createdTs = getUnixTime(createdAt);

    if (createdTs > nowTs) {
      toast.error(t("message.invalid-created-datetime"));
      return;
    }

    try {
      await memoStore.patchMemo({
        id: memoId,
        createdTs,
      });
      toast.success(t("message.memo-updated-datetime"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
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
      <div className="flex flex-col justify-start items-start !w-72 max-w-full">
        <div className="w-full bg-yellow-100 border border-yellow-400 rounded p-2 text-black">
          <p className="uppercase">{t("message.change-memo-created-time-warning-1")}</p>
          <p>{t("message.change-memo-created-time-warning-2")}</p>
        </div>
        <input
          className="input-text mt-2"
          type="datetime-local"
          value={createdAt}
          max={maxDatetimeValue}
          onChange={handleDatetimeInputChange}
        />
        <div className="flex flex-row justify-end items-center mt-2 w-full">
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
