import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import clsx from "clsx";
import copy from "copy-to-clipboard";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import Icon from "@/components/Icon";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import showMemoEditorDialog from "./MemoEditor/MemoEditorDialog";

interface Props {
  memo: Memo;
  className?: string;
  hiddenActions?: ("edit" | "archive" | "delete" | "share" | "pin")[];
}

const MemoActionMenu = (props: Props) => {
  const { memo, hiddenActions } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const memoStore = useMemoStore();
  const isInMemoDetailPage = location.pathname.startsWith(`/m/${memo.uid}`);

  const handleTogglePinMemoBtnClick = async () => {
    try {
      if (memo.pinned) {
        await memoStore.updateMemo(
          {
            name: memo.name,
            pinned: false,
          },
          ["pinned"],
        );
      } else {
        await memoStore.updateMemo(
          {
            name: memo.name,
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
      memoName: memo.name,
      cacheKey: `${memo.name}-${memo.updateTime}`,
    });
  };

  const handleToggleMemoStatusClick = async () => {
    try {
      if (memo.rowStatus === RowStatus.ARCHIVED) {
        await memoStore.updateMemo(
          {
            name: memo.name,
            rowStatus: RowStatus.ACTIVE,
          },
          ["row_status"],
        );
        toast(t("message.restored-successfully"));
      } else {
        await memoStore.updateMemo(
          {
            name: memo.name,
            rowStatus: RowStatus.ARCHIVED,
          },
          ["row_status"],
        );
        toast.success(t("message.archived-successfully"));
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
      return;
    }

    if (isInMemoDetailPage) {
      memo.rowStatus === RowStatus.ARCHIVED ? navigateTo("/") : navigateTo("/archived");
    }
  };

  const handleCopyLink = () => {
    copy(`${window.location.origin}/m/${memo.uid}`);
    toast.success(t("message.succeed-copy-link"));
  };

  const handleDeleteMemoClick = async () => {
    const confirmed = window.confirm(t("memo.delete-confirm"));
    if (confirmed) {
      await memoStore.deleteMemo(memo.name);
      toast.success(t("message.deleted-successfully"));
      if (isInMemoDetailPage) {
        navigateTo("/");
      }
    }
  };

  return (
    <Dropdown>
      <MenuButton slots={{ root: "div" }}>
        <span className={clsx("flex justify-center items-center rounded-full hover:opacity-70", props.className)}>
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
          <MenuItem onClick={handleCopyLink}>
            <Icon.Copy className="w-4 h-auto" />
            {t("memo.copy-link")}
          </MenuItem>
        )}
        <MenuItem color="warning" onClick={handleToggleMemoStatusClick}>
          {memo.rowStatus === RowStatus.ARCHIVED ? <Icon.ArchiveRestore className="w-4 h-auto" /> : <Icon.Archive className="w-4 h-auto" />}
          {memo.rowStatus === RowStatus.ARCHIVED ? t("common.restore") : t("common.archive")}
        </MenuItem>
        <MenuItem color="danger" onClick={handleDeleteMemoClick}>
          <Icon.Trash className="w-4 h-auto" />
          {t("common.delete")}
        </MenuItem>
      </Menu>
    </Dropdown>
  );
};

export default MemoActionMenu;
