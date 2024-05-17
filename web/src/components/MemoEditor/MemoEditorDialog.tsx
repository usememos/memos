import { IconButton } from "@mui/joy";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useMemoStore, useTagStore } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";
import MemoEditor, { Props as MemoEditorProps } from ".";
import { generateDialog } from "../Dialog";
import Icon from "../Icon";

interface Props extends DialogProps, MemoEditorProps {}

const MemoEditorDialog: React.FC<Props> = ({
  memoName,
  parentMemoName,
  placeholder,
  cacheKey,
  relationList,
  onConfirm,
  destroy,
}: Props) => {
  const tagStore = useTagStore();
  const memoStore = useMemoStore();
  const [displayTime, setDisplayTime] = useState<string | undefined>(memoStore.getMemoByName(memoName || "")?.displayTime?.toISOString());
  const memoPatchRef = useRef<Partial<Memo>>({
    displayTime: memoStore.getMemoByName(memoName || "")?.displayTime,
  });

  useEffect(() => {
    tagStore.fetchTags(undefined, { skipCache: false });
  }, []);

  const updateDisplayTime = (displayTime: string) => {
    setDisplayTime(displayTime);
    memoPatchRef.current.displayTime = new Date(displayTime);
  };

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
      <div className="w-full flex flex-row justify-between items-center">
        <div className={clsx("flex flex-row justify-start items-center", !displayTime && "mb-2")}>
          {displayTime ? (
            <div className="relative">
              <span className="cursor-pointer text-gray-500 dark:text-gray-400">{new Date(displayTime).toLocaleString()}</span>
              <input
                className="inset-0 absolute z-1 opacity-0"
                type="datetime-local"
                value={displayTime}
                onFocus={(e: any) => e.target.showPicker()}
                onChange={(e) => updateDisplayTime(e.target.value)}
              />
            </div>
          ) : (
            <>
              <img className="w-6 h-auto rounded-full shadow" src={"/full-logo.webp"} alt="" />
              <p className="ml-1 text-lg opacity-80 dark:text-gray-300">Memos</p>
            </>
          )}
        </div>
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[36rem]">
        <MemoEditor
          className="border-none !p-0 -mb-2"
          cacheKey={`memo-editor-${cacheKey || memoName}`}
          memoName={memoName}
          parentMemoName={parentMemoName}
          placeholder={placeholder}
          relationList={relationList}
          memoPatchRef={memoPatchRef}
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
