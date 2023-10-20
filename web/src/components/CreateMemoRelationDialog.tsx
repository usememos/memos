import { Button, Input } from "@mui/joy";
import { isNaN, unionBy } from "lodash-es";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { memoServiceClient } from "@/grpcweb";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

interface Props extends DialogProps {
  onCancel?: () => void;
  onConfirm?: (memoIdList: number[]) => void;
}

const CreateMemoRelationDialog: React.FC<Props> = (props: Props) => {
  const { destroy, onCancel, onConfirm } = props;
  const t = useTranslate();
  const [memoId, setMemoId] = useState<string>("");
  const [memoList, setMemoList] = useState<Memo[]>([]);

  const handleMemoIdInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSaveBtnClick();
    }
  };

  const handleMemoIdChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const memoId = event.target.value;
    setMemoId(memoId.trim());
  };

  const handleSaveBtnClick = async () => {
    const id = Number(memoId);
    if (isNaN(id)) {
      toast.error("Invalid memo id");
      return;
    }

    try {
      const { memo } = await memoServiceClient.getMemo({
        id,
      });
      if (!memo) {
        toast.error("Not found memo");
        return;
      }

      setMemoId("");
      setMemoList(unionBy([memo, ...memoList], "id"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  const handleDeleteMemoRelation = async (memo: Memo) => {
    setMemoList(memoList.filter((m) => m !== memo));
  };

  const handleCloseDialog = () => {
    if (onCancel) {
      onCancel();
    }
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    if (onConfirm) {
      onConfirm(memoList.map((memo) => memo.id));
    }
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{"Add references"}</p>
        <button className="btn close-btn" onClick={() => destroy()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <Input
          className="mb-2"
          size="md"
          placeholder={"Input memo ID. e.g. 26"}
          value={memoId}
          onChange={handleMemoIdChanged}
          onKeyDown={handleMemoIdInputKeyDown}
          fullWidth
          endDecorator={<Icon.PlusCircle onClick={handleSaveBtnClick} className="w-4 h-auto cursor-pointer hover:opacity-80" />}
        />
        {memoList.length > 0 && (
          <>
            <div className="w-full flex flex-row justify-start items-start flex-wrap gap-2 mt-1">
              {memoList.map((memo) => (
                <div
                  className="max-w-[50%] text-sm px-3 py-1 flex flex-row justify-start items-center border rounded-full cursor-pointer truncate opacity-80 dark:text-gray-300 hover:opacity-60 hover:line-through"
                  key={memo.id}
                  onClick={() => handleDeleteMemoRelation(memo)}
                >
                  <span className="opacity-60 shrink-0">#{memo.id}</span>
                  <span className="mx-1 max-w-full text-ellipsis whitespace-nowrap overflow-hidden">{memo.content}</span>
                  <Icon.X className="opacity-80 w-4 h-auto shrink-0 ml-1" />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseDialog}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={memoList.length === 0}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateMemoRelationDialog(props: Omit<Props, "destroy" | "hide">) {
  generateDialog(
    {
      className: "create-memo-relation-dialog",
      dialogName: "create-memo-relation-dialog",
    },
    CreateMemoRelationDialog,
    props
  );
}

export default showCreateMemoRelationDialog;
