import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import useLoading from "@/hooks/useLoading";
import { useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import ArchivedMemo from "./ArchivedMemo";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import "@/less/archived-memo-dialog.less";

type Props = DialogProps;

const ArchivedMemoDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { destroy } = props;
  const memoStore = useMemoStore();
  const memos = memoStore.state.memos;
  const loadingState = useLoading();
  const [archivedMemos, setArchivedMemos] = useState<Memo[]>([]);

  useEffect(() => {
    memoStore
      .fetchArchivedMemos()
      .then((result) => {
        setArchivedMemos(result);
      })
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, [memos]);

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("memo.archived-memos")}</p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        {loadingState.isLoading ? (
          <div className="tip-text-container">
            <p className="tip-text">{t("memo.fetching-data")}</p>
          </div>
        ) : archivedMemos.length === 0 ? (
          <div className="tip-text-container">
            <p className="tip-text">{t("memo.no-archived-memos")}</p>
          </div>
        ) : (
          <div className="archived-memos-container">
            {archivedMemos.map((memo) => (
              <ArchivedMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default function showArchivedMemoDialog(): void {
  generateDialog(
    {
      className: "archived-memo-dialog",
      dialogName: "archived-memo-dialog",
    },
    ArchivedMemoDialog,
    {}
  );
}
