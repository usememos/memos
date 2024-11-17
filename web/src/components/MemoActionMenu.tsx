import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import clsx from "clsx";
import copy from "copy-to-clipboard";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BookmarkMinusIcon,
  BookmarkPlusIcon,
  CopyIcon,
  Edit3Icon,
  MoreVerticalIcon,
  TrashIcon,
  SquareCheckIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { markdownServiceClient } from "@/grpcweb";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v1/common";
import { NodeType } from "@/types/proto/api/v1/markdown_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  className?: string;
  hiddenActions?: ("edit" | "archive" | "delete" | "share" | "pin" | "remove_completed_task_list")[];
  onEdit?: () => void;
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
    if (props.onEdit) {
      props.onEdit();
      return;
    }
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
      toast.error(error.details);
      console.error(error);
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

  const handleRemoveCompletedTaskListItemsClick = async () => {
    const confirmed = window.confirm(t("memo.remove-completed-task-list-items-confirm"));
    if (confirmed) {
      const newNodes = JSON.parse(JSON.stringify(memo.nodes));
      for (const node of newNodes) {
        if (node.type === NodeType.LIST && node.listNode?.children?.length > 0) {
          const children = node.listNode.children;
          for (let i = 0; i < children.length; i++) {
            if (children[i].type === NodeType.TASK_LIST_ITEM && children[i].taskListItemNode?.complete) {
              // Remove completed taskList item and next line breaks
              children.splice(i, 1);
              if (children[i]?.type === NodeType.LINE_BREAK) {
                children.splice(i, 1);
              }
              i--;
            }
          }
        }
      }
      const { markdown } = await markdownServiceClient.restoreMarkdownNodes({ nodes: newNodes });
      await memoStore.updateMemo(
        {
          name: memo.name,
          content: markdown,
        },
        ["content"],
      );
      toast.success(t("message.remove-completed-task-list-items-successfully"));
    }
  };

  return (
    <Dropdown>
      <MenuButton slots={{ root: "div" }}>
        <span className={clsx("flex justify-center items-center rounded-full hover:opacity-70", props.className)}>
          <MoreVerticalIcon className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400" />
        </span>
      </MenuButton>
      <Menu className="text-sm" size="sm" placement="bottom-end">
        {!hiddenActions?.includes("pin") && (
          <MenuItem onClick={handleTogglePinMemoBtnClick}>
            {memo.pinned ? <BookmarkMinusIcon className="w-4 h-auto" /> : <BookmarkPlusIcon className="w-4 h-auto" />}
            {memo.pinned ? t("common.unpin") : t("common.pin")}
          </MenuItem>
        )}
        {!hiddenActions?.includes("edit") && props.onEdit && (
          <MenuItem onClick={handleEditMemoClick}>
            <Edit3Icon className="w-4 h-auto" />
            {t("common.edit")}
          </MenuItem>
        )}
        {!hiddenActions?.includes("share") && (
          <MenuItem onClick={handleCopyLink}>
            <CopyIcon className="w-4 h-auto" />
            {t("memo.copy-link")}
          </MenuItem>
        )}
        <MenuItem color="warning" onClick={handleToggleMemoStatusClick}>
          {memo.rowStatus === RowStatus.ARCHIVED ? <ArchiveRestoreIcon className="w-4 h-auto" /> : <ArchiveIcon className="w-4 h-auto" />}
          {memo.rowStatus === RowStatus.ARCHIVED ? t("common.restore") : t("common.archive")}
        </MenuItem>
        {!hiddenActions?.includes("remove_completed_task_list") && (
          <MenuItem color="danger" onClick={handleRemoveCompletedTaskListItemsClick}>
            <SquareCheckIcon className="w-4 h-auto" />
            {t("memo.remove-completed-task-list-items")}
          </MenuItem>
        )}
        <MenuItem color="danger" onClick={handleDeleteMemoClick}>
          <TrashIcon className="w-4 h-auto" />
          {t("common.delete")}
        </MenuItem>
      </Menu>
    </Dropdown>
  );
};

export default MemoActionMenu;
