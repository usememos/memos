import { useCallback, useEffect, useState } from "react";
import useLoading from "../hooks/useLoading";
import { locationService, memoService } from "../services";
import { showDialog } from "./Dialog";
import toastHelper from "./Toast";
import DeletedMemo from "./DeletedMemo";
import "../less/memo-trash-dialog.less";

interface Props extends DialogProps {}

const MemoTrashDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const loadingState = useLoading();
  const [deletedMemos, setDeletedMemos] = useState<Memo[]>([]);

  useEffect(() => {
    memoService
      .fetchDeletedMemos()
      .then((result) => {
        setDeletedMemos(result);
      })
      .catch((error) => {
        toastHelper.error("Failed to fetch deleted memos: ", error);
      })
      .finally(() => {
        loadingState.setFinish();
      });
    locationService.clearQuery();
  }, []);

  const handleDeletedMemoAction = useCallback(async (memoId: MemoId) => {
    setDeletedMemos((deletedMemos) => deletedMemos.filter((memo) => memo.id !== memoId));
    await memoService.fetchAllMemos();
  }, []);

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🗑️</span>
          Recycle Bin
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        {loadingState.isLoading ? (
          <div className="tip-text-container">
            <p className="tip-text">fetching data...</p>
          </div>
        ) : deletedMemos.length === 0 ? (
          <div className="tip-text-container">
            <p className="tip-text">Here is No Zettels.</p>
          </div>
        ) : (
          <div className="deleted-memos-container">
            {deletedMemos.map((memo) => (
              <DeletedMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} handleDeletedMemoAction={handleDeletedMemoAction} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default function showMemoTrashDialog(): void {
  showDialog(
    {
      className: "memo-trash-dialog",
      useAppContext: true,
    },
    MemoTrashDialog,
    {}
  );
}
