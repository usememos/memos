import { Divider, Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import classNames from "classnames";
import copy from "copy-to-clipboard";
import toast from "react-hot-toast";
import Icon from "@/components/Icon";
import { useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v2/common";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showMemoEditorDialog from "./MemoEditor/MemoEditorDialog";
import showShareMemoDialog from "./ShareMemoDialog";

interface Props {
  memo: Memo;
  className?: string;
  hiddenActions?: ("edit" | "archive" | "delete" | "share" | "pin")[];
  onArchived?: () => void;
  onDeleted?: () => void;
}

const MemoActionMenu = (props: Props) => {
  const { memo, hiddenActions } = props;
  const t = useTranslate();
  const memoStore = useMemoStore();

  const handleTogglePinMemoBtnClick = async () => {
    try {
      if (memo.pinned) {
        await memoStore.updateMemo(
          {
            id: memo.id,
            pinned: false,
          },
          ["pinned"],
        );
      } else {
        await memoStore.updateMemo(
          {
            id: memo.id,
            pinned: true,
          },
          ["pinned"],
        );
      }
    } catch (error) {
      // do nth
    }
  };

  const handleEditMemoClick = () => {
    showMemoEditorDialog({
      memoId: memo.id,
      cacheKey: `${memo.id}-${memo.updateTime}`,
    });
  };

  const handleArchiveMemoClick = async () => {
    try {
      await memoStore.updateMemo(
        {
          id: memo.id,
          rowStatus: RowStatus.ARCHIVED,
        },
        ["row_status"],
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
    if (props.onArchived) {
      props.onArchived();
    }
  };

  const handleDeleteMemoClick = async () => {
    showCommonDialog({
      title: t("memo.delete-memo"),
      content: t("memo.delete-confirm"),
      style: "danger",
      dialogName: "delete-memo-dialog",
      onConfirm: async () => {
        await memoStore.deleteMemo(memo.id);
        if (props.onDeleted) {
          props.onDeleted();
        }
      },
    });
  };

  const handleCopyMemoId = () => {
    copy(memo.name);
    toast.success("Copied to clipboard!");
  };

  return (
    <Dropdown>
      <MenuButton slots={{ root: "div" }}>
        <span className={classNames("flex justify-center items-center rounded-full hover:opacity-70", props.className)}>
          <Icon.MoreVertical className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400" />
        </span>
      </MenuButton>
      <Menu className="text-sm" size="sm" placement="bottom-end">
        {!hiddenActions?.includes("pin") && (
          <MenuItem onClick={handleTogglePinMemoBtnClick}>
            {memo.pinned ? <Icon.BookmarkMinus className="w-4 h-auto" /> : <Icon.BookmarkPlus className="w-4 h-auto" />}
            {memo.pinned ? t("common.unpin") : t("common.pin")}
          </MenuItem>
        )}
        {!hiddenActions?.includes("edit") && (
          <MenuItem onClick={handleEditMemoClick}>
            <Icon.Edit3 className="w-4 h-auto" />
            {t("common.edit")}
          </MenuItem>
        )}
        {!hiddenActions?.includes("share") && (
          <MenuItem onClick={() => showShareMemoDialog(memo.id)}>
            <Icon.Share className="w-4 h-auto" />
            {t("common.share")}
          </MenuItem>
        )}
        <MenuItem color="warning" onClick={handleArchiveMemoClick}>
          <Icon.Archive className="w-4 h-auto" />
          {t("common.archive")}
        </MenuItem>
        <MenuItem color="danger" onClick={handleDeleteMemoClick}>
          <Icon.Trash className="w-4 h-auto" />
          {t("common.delete")}
        </MenuItem>
        <Divider className="!my-1" />
        <div className="-mt-0.5 pl-2 pr-2 text-xs text-gray-400">
          <div className="mt-1 font-mono max-w-20 cursor-pointer truncate" onClick={handleCopyMemoId}>
            ID: {memo.name}
          </div>
        </div>
      </Menu>
    </Dropdown>
  );
};

export default MemoActionMenu;
