import { useEffect } from "react";
import { useTagStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import MemoEditor from ".";
import { generateDialog } from "../Dialog";
import Icon from "../Icon";

interface Props extends DialogProps {
  memoId?: MemoId;
  relationList?: MemoRelation[];
}

const MemoEditorDialog: React.FC<Props> = ({ memoId, relationList, destroy }: Props) => {
  const t = useTranslate();
  const tagStore = useTagStore();

  useEffect(() => {
    tagStore.fetchTags();
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex items-center">{t("amount-text.memo_one")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[36rem]">
        <MemoEditor memoId={memoId} relationList={relationList} onConfirm={handleCloseBtnClick} />
      </div>
    </>
  );
};

export default function showMemoEditorDialog(props: Pick<Props, "memoId" | "relationList"> = {}): void {
  generateDialog(
    {
      className: "memo-editor-dialog",
      dialogName: "memo-editor-dialog",
    },
    MemoEditorDialog,
    props
  );
}
