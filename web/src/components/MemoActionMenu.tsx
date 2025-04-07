import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
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
import { userStore } from "@/store/v2";
import { State } from "@/types/proto/api/v1/common";
import { NodeType } from "@/types/proto/api/v1/markdown_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  readonly?: boolean;
  className?: string;
  onEdit?: () => void;
}

const checkHasCompletedTaskList = (memo: Memo) => {
  for (const node of memo.nodes) {
    if (node.type === NodeType.LIST && node.listNode?.children && node.listNode?.children?.length > 0) {
      for (let j = 0; j < node.listNode.children.length; j++) {
        if (node.listNode.children[j].type === NodeType.TASK_LIST_ITEM && node.listNode.children[j].taskListItemNode?.complete) {
          return true;
        }
      }
    }
  }
  return false;
};

const MemoActionMenu = (props: Props) => {
  const { memo, readonly } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const memoStore = useMemoStore();
  const isArchived = memo.state === State.ARCHIVED;
  const hasCompletedTaskList = checkHasCompletedTaskList(memo);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);

  const memoUpdatedCallback = () => {
    // Refresh user stats.
    userStore.setStatsStateId();
  };

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
    const state = memo.state === State.ARCHIVED ? State.NORMAL : State.ARCHIVED;
    const message = memo.state === State.ARCHIVED ? t("message.restored-successfully") : t("message.archived-successfully");
    try {
      await memoStore.updateMemo(
        {
          name: memo.name,
          state,
        },
        ["state"],
      );
      toast(message);
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
      return;
    }

    if (isInMemoDetailPage) {
      memo.state === State.ARCHIVED ? navigateTo("/") : navigateTo("/archived");
    }
    memoUpdatedCallback();
  };

  const handleCopyLink = () => {
    copy(`${window.location.origin}/${memo.name}`);
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
      memoUpdatedCallback();
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
      memoUpdatedCallback();
    }
  };

  return (
    <Dropdown>
      <MenuButton slots={{ root: "div" }}>
        <span className={cn("flex justify-center items-center rounded-full hover:opacity-70", props.className)}>
          <MoreVerticalIcon className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400" />
        </span>
      </MenuButton>
      <Menu className="text-sm" size="sm" placement="bottom-end">
        {!readonly && !isArchived && (
          <>
            <MenuItem onClick={handleTogglePinMemoBtnClick}>
              {memo.pinned ? <BookmarkMinusIcon className="w-4 h-auto" /> : <BookmarkPlusIcon className="w-4 h-auto" />}
              {memo.pinned ? t("common.unpin") : t("common.pin")}
            </MenuItem>
            <MenuItem onClick={handleEditMemoClick}>
              <Edit3Icon className="w-4 h-auto" />
              {t("common.edit")}
            </MenuItem>
          </>
        )}
        {!isArchived && (
          <MenuItem onClick={handleCopyLink}>
            <CopyIcon className="w-4 h-auto" />
            {t("memo.copy-link")}
          </MenuItem>
        )}
        {!readonly && (
          <>
            {!isArchived && hasCompletedTaskList && (
              <MenuItem color="warning" onClick={handleRemoveCompletedTaskListItemsClick}>
                <SquareCheckIcon className="w-4 h-auto" />
                {t("memo.remove-completed-task-list-items")}
              </MenuItem>
            )}
            <MenuItem color="warning" onClick={handleToggleMemoStatusClick}>
              {isArchived ? <ArchiveRestoreIcon className="w-4 h-auto" /> : <ArchiveIcon className="w-4 h-auto" />}
              {isArchived ? t("common.restore") : t("common.archive")}
            </MenuItem>
            <MenuItem color="danger" onClick={handleDeleteMemoClick}>
              <TrashIcon className="w-4 h-auto" />
              {t("common.delete")}
            </MenuItem>
          </>
        )}
      </Menu>
    </Dropdown>
  );
};

export default MemoActionMenu;
