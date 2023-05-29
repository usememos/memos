import { generateDialog } from "../Dialog";
import Icon from "../Icon";
import MemoEditor from ".";

interface Props extends DialogProps {
  memoId?: MemoId;
}

const MemoEditorDialog: React.FC<Props> = ({ memoId, destroy }: Props) => {
  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex items-center">MEMOS</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[36rem]">
        <MemoEditor memoId={memoId} onConfirm={handleCloseBtnClick} />
      </div>
    </>
  );
};

export default function showMemoEditorDialog(memoId?: MemoId): void {
  generateDialog(
    {
      className: "memo-editor-dialog",
      dialogName: "memo-editor-dialog",
    },
    MemoEditorDialog,
    { memoId }
  );
}
