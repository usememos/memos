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
import { observer } from "mobx-react-lite";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { markdownServiceClient } from "@/grpcweb";
import useNavigateTo from "@/hooks/useNavigateTo";
import { memoStore, userStore } from "@/store";
import { workspaceStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { NodeType } from "@/types/proto/api/v1/markdown_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

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

const MemoActionMenu = observer((props: Props) => {
  const { memo, readonly } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const hasCompletedTaskList = checkHasCompletedTaskList(memo);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);
  const isComment = Boolean(memo.parent);
  const isArchived = memo.state === State.ARCHIVED;

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
    } catch {
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
      navigateTo(memo.state === State.ARCHIVED ? "/" : "/archived");
    }
    memoUpdatedCallback();
  };

  const handleCopyLink = () => {
    let host = workspaceStore.state.profile.instanceUrl;
    if (host === "") {
      host = window.location.origin;
    }
    copy(`${host}/${memo.name}`);
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-4">
          <MoreVerticalIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={2}>
        {!readonly && !isArchived && (
          <>
            {!isComment && (
              <DropdownMenuItem onClick={handleTogglePinMemoBtnClick}>
                {memo.pinned ? <BookmarkMinusIcon className="w-4 h-auto" /> : <BookmarkPlusIcon className="w-4 h-auto" />}
                {memo.pinned ? t("common.unpin") : t("common.pin")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleEditMemoClick}>
              <Edit3Icon className="w-4 h-auto" />
              {t("common.edit")}
            </DropdownMenuItem>
          </>
        )}
        {!isArchived && (
          <DropdownMenuItem onClick={handleCopyLink}>
            <CopyIcon className="w-4 h-auto" />
            {t("memo.copy-link")}
          </DropdownMenuItem>
        )}
        {!readonly && (
          <>
            {!isArchived && !isComment && hasCompletedTaskList && (
              <DropdownMenuItem onClick={handleRemoveCompletedTaskListItemsClick}>
                <SquareCheckIcon className="w-4 h-auto" />
                {t("memo.remove-completed-task-list-items")}
              </DropdownMenuItem>
            )}
            {!isComment && (
              <DropdownMenuItem onClick={handleToggleMemoStatusClick}>
                {isArchived ? <ArchiveRestoreIcon className="w-4 h-auto" /> : <ArchiveIcon className="w-4 h-auto" />}
                {isArchived ? t("common.restore") : t("common.archive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDeleteMemoClick}>
              <TrashIcon className="w-4 h-auto" />
              {t("common.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default MemoActionMenu;
