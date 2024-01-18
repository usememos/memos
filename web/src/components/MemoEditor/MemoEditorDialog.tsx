import { IconButton } from "@mui/joy";
import { useEffect } from "react";
import { useGlobalStore, useTagStore } from "@/store/module";
import { MemoRelation } from "@/types/proto/api/v2/memo_relation_service";
import MemoEditorV1 from ".";
import { generateDialog } from "../Dialog";
import Icon from "../Icon";

interface Props extends DialogProps {
  memoId?: number;
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
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-[36rem]">
        <MemoEditorV1
          className="border-none !p-0 -mb-2"
          cacheKey={`memo-editor-${memoId}`}
          memoId={memoId}
          relationList={relationList}
          onConfirm={handleCloseBtnClick}
          autoFocus
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
      containerClassName: "dark:!bg-zinc-800",
    },
    MemoEditorDialog,
    props
  );
}
