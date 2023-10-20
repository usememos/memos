import { useEffect } from "react";
import { useGlobalStore, useTagStore } from "@/store/module";
import MemoEditor from ".";
import { generateDialog } from "../Dialog";
import Icon from "../Icon";

interface Props extends DialogProps {
  memoId?: MemoId;
  relationList?: MemoRelation[];
}

const MemoEditorDialog: React.FC<Props> = ({ memoId, relationList, destroy }: Props) => {
  const globalStore = useGlobalStore();
  const tagStore = useTagStore();
  const { systemStatus } = globalStore.state;

  useEffect(() => {
    tagStore.fetchTags();
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <div className="flex flex-row justify-start items-center">
          <img className="w-5 h-auto rounded-full shadow" src={systemStatus.customizedProfile.logoUrl} alt="" />
          <p className="ml-1 text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
        </div>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[36rem]">
        <MemoEditor
          className="border-none !p-0 -mb-2"
          cacheKey={`memo-editor-${memoId}`}
          memoId={memoId}
          relationList={relationList}
          onConfirm={handleCloseBtnClick}
        />
      </div>
    </>
  );
};

export default function showMemoEditorDialog(props: Pick<Props, "memoId" | "relationList"> = {}): void {
  generateDialog(
    {
      className: "memo-editor-dialog",
      dialogName: "memo-editor-dialog",
      containerClassName: "dark:!bg-zinc-700",
    },
    MemoEditorDialog,
    props
  );
}
