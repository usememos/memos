import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowUpRightIcon,
  BookmarkMinusIcon,
  BookmarkPlusIcon,
  CheckCheckIcon,
  CopyIcon,
  Edit3Icon,
  FileTextIcon,
  LinkIcon,
  ListRestartIcon,
  MoreVerticalIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { State } from "@/types/proto/api/common_pb";
import { useTranslate } from "@/utils/i18n";
import { createMemoNavigationState } from "../MemoView/navigation";
import { useMemoActionHandlers } from "./hooks";
import type { MemoActionMenuProps } from "./types";

/**
 * The memo's action menu, grouped by what each action does to the card:
 * write on it (Edit, the task action), place it (Pin, Archive), reach it beyond
 * the feed (Open its page, Copy its link or content), then Delete last.
 * A memo's Space is changed in the editor, not here. An archived memo offers
 * only Restore and Delete, and a viewer only Open and Copy.
 */
const MemoActionMenu = (props: MemoActionMenuProps) => {
  const { memo, parentPage, readonly } = props;
  const t = useTranslate();

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Derived state
  const isComment = Boolean(memo.parent);
  const isArchived = memo.state === State.ARCHIVED;
  const hasTaskList = Boolean(memo.property?.hasTaskList);
  const hasOpenTasks = Boolean(memo.property?.hasIncompleteTasks);

  // Action handlers
  const {
    isInMemoDetailPage,
    handleTogglePinMemoBtnClick,
    handleEditMemoClick,
    handleToggleMemoStatusClick,
    handleCopyLink,
    handleCopyContent,
    handleCheckAllTaskListItemsClick,
    handleUncheckAllTaskListItemsClick,
    handleDeleteMemoClick,
    confirmDeleteMemo,
  } = useMemoActionHandlers({
    memo,
    parentPage,
    onEdit: props.onEdit,
    setDeleteDialogOpen,
  });

  // A comment opens in the context of its parent memo, never on its own.
  const openItem = !isComment && !isInMemoDetailPage && (
    <DropdownMenuLinkItem
      closeOnClick
      render={
        <Link to={`/${memo.name}`} state={parentPage !== undefined ? createMemoNavigationState(parentPage) : undefined} viewTransition />
      }
    >
      <ArrowUpRightIcon />
      {t("common.open")}
    </DropdownMenuLinkItem>
  );

  const copySubmenu = (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <CopyIcon />
        {t("common.copy")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={handleCopyLink}>
          <LinkIcon />
          {t("memo.copy-link")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyContent}>
          <FileTextIcon />
          {t("memo.copy-content")}
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );

  const deleteItem = (
    <DropdownMenuItem variant="destructive" onClick={handleDeleteMemoClick}>
      <TrashIcon />
      {t("common.delete")}
    </DropdownMenuItem>
  );

  const renderItems = () => {
    if (readonly) {
      return (
        <>
          {openItem}
          {copySubmenu}
        </>
      );
    }

    if (isArchived) {
      return (
        <>
          <DropdownMenuItem onClick={handleToggleMemoStatusClick}>
            <ArchiveRestoreIcon />
            {t("common.restore")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {deleteItem}
        </>
      );
    }

    return (
      <>
        <DropdownMenuItem onClick={handleEditMemoClick}>
          <Edit3Icon />
          {t("common.edit")}
        </DropdownMenuItem>
        {/* One task action at a time: finish the open tasks, or reset a finished list. */}
        {hasTaskList &&
          (hasOpenTasks ? (
            <DropdownMenuItem onClick={handleCheckAllTaskListItemsClick}>
              <CheckCheckIcon />
              {t("memo.task-actions.check-all")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleUncheckAllTaskListItemsClick}>
              <ListRestartIcon />
              {t("memo.task-actions.uncheck-all")}
            </DropdownMenuItem>
          ))}

        {/* A comment has no place of its own to pin or archive; it lives under its parent. */}
        {!isComment && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleTogglePinMemoBtnClick}>
              {memo.pinned ? <BookmarkMinusIcon /> : <BookmarkPlusIcon />}
              {memo.pinned ? t("common.unpin") : t("common.pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleMemoStatusClick}>
              <ArchiveIcon />
              {t("common.archive")}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        {openItem}
        {copySubmenu}

        <DropdownMenuSeparator />
        {deleteItem}
      </>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="quiet" size="icon-sm" aria-label={t("common.more")} />}>
        <MoreVerticalIcon className="size-4" strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={2} size="sm">
        {renderItems()}
      </DropdownMenuContent>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("memo.delete-confirm")}
        confirmLabel={t("common.delete")}
        description={t("memo.delete-confirm-description")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteMemo}
        confirmVariant="destructive"
      />
    </DropdownMenu>
  );
};

export default MemoActionMenu;
