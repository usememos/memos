import { IconButton } from "@mui/joy";
import { useEffect } from "react";
import { useTagStore } from "@/store/v1";
import MemoEditor, { Props as MemoEditorProps } from ".";
import { generateDialog } from "../Dialog";
import Icon from "../Icon";

interface Props extends DialogProps, MemoEditorProps {}

const MemoEditorDialog: React.FC<Props> = ({
  memoName: memo,
  parentMemoName,
  placeholder,
  cacheKey,
  relationList,
  onConfirm,
  destroy,
}: Props) => {
  const tagStore = useTagStore();

  useEffect(() => {
    tagStore.fetchTags({ skipCache: false });
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleConfirm = (memoName: string) => {
    handleCloseBtnClick();
    if (onConfirm) {
      onConfirm(memoName);
    }
  };

  return (
    <>
      <div className="w-full flex flex-row justify-between items-center mb-2">
        <div className="flex flex-row justify-start items-center">
          <img className="w-6 h-auto rounded-full shadow" src={"/full-logo.webp"} alt="" />
          <p className="ml-1 text-lg opacity-80 dark:text-gray-300">Memos</p>
        </div>
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[36rem]">
        <MemoEditor
          className="border-none !p-0 -mb-2"
          cacheKey={`memo-editor-${cacheKey || memo}`}
          memoName={memo}
          parentMemoName={parentMemoName}
          placeholder={placeholder}
          relationList={relationList}
          onConfirm={handleConfirm}
          autoFocus
        />
      </div>
    </>
  );
};

export default function showMemoEditorDialog(props: Partial<Props> = {}): void {
  generateDialog(
    {
      className: "memo-editor-dialog",
      dialogName: "memo-editor-dialog",
    },
    MemoEditorDialog,
    props,
  );
}
