import { ArchiveIcon, ArchiveRestoreIcon, BookmarkMinusIcon, BookmarkPlusIcon, Edit3Icon, TrashIcon } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useMemoActionHandlers } from "../../MemoActionMenu/hooks";

export const QUICK_ACTIONS_STORAGE_KEY = "memo-quick-actions-enabled";

interface MemoQuickActionsProps {
  memo: Memo;
  readonly: boolean;
  onEdit?: () => void;
}

const MemoQuickActions: React.FC<MemoQuickActionsProps> = ({ memo, readonly, onEdit }) => {
  const t = useTranslate();
  const [enabled] = useLocalStorage(QUICK_ACTIONS_STORAGE_KEY, false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isComment = Boolean(memo.parent);
  const isArchived = memo.state === State.ARCHIVED;

  const { handleTogglePinMemoBtnClick, handleEditMemoClick, handleToggleMemoStatusClick, handleDeleteMemoClick, confirmDeleteMemo } =
    useMemoActionHandlers({ memo, onEdit, setDeleteDialogOpen });

  if (!enabled || readonly) return null;

  return (
    <>
      <div className="hidden sm:group-hover:flex items-center gap-0.5">
        {!isComment && !isArchived && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6" onClick={handleTogglePinMemoBtnClick}>
                  {memo.pinned ? (
                    <BookmarkMinusIcon className="w-4 h-auto text-muted-foreground" />
                  ) : (
                    <BookmarkPlusIcon className="w-4 h-auto text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{memo.pinned ? t("common.unpin") : t("common.pin")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!isArchived && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6" onClick={handleEditMemoClick}>
                  <Edit3Icon className="w-4 h-auto text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.edit")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!isComment && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6" onClick={handleToggleMemoStatusClick}>
                  {isArchived ? (
                    <ArchiveRestoreIcon className="w-4 h-auto text-muted-foreground" />
                  ) : (
                    <ArchiveIcon className="w-4 h-auto text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isArchived ? t("common.restore") : t("common.archive")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6" onClick={handleDeleteMemoClick}>
                <TrashIcon className="w-4 h-auto text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.delete")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

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
    </>
  );
};

export default MemoQuickActions;
