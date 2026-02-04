import { Edit3Icon, MoreVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { shortcutServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { cn } from "@/lib/utils";
import { Shortcut } from "@/types/proto/api/v1/shortcut_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateShortcutDialog from "../CreateShortcutDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;

// Helper function to extract shortcut ID from resource name
// Format: users/{user}/shortcuts/{shortcut}
const getShortcutId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : "";
};

function ShortcutsSection() {
  const t = useTranslate();
  const { shortcuts, refetchSettings } = useAuth();
  const { shortcut: selectedShortcut, setShortcut } = useMemoFilterContext();
  const [isCreateShortcutDialogOpen, setIsCreateShortcutDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shortcut | undefined>();
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | undefined>();

  useEffect(() => {
    refetchSettings();
  }, [refetchSettings]);

  const handleDeleteShortcut = async (shortcut: Shortcut) => {
    setDeleteTarget(shortcut);
  };

  const confirmDeleteShortcut = async () => {
    if (!deleteTarget) return;
    await shortcutServiceClient.deleteShortcut({ name: deleteTarget.name });
    await refetchSettings();
    toast.success(t("setting.shortcut.delete-success", { title: deleteTarget.title }));
    setDeleteTarget(undefined);
  };

  const handleCreateShortcut = () => {
    setEditingShortcut(undefined);
    setIsCreateShortcutDialogOpen(true);
  };

  const handleEditShortcut = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut);
    setIsCreateShortcutDialogOpen(true);
  };

  const handleShortcutDialogSuccess = () => {
    setIsCreateShortcutDialogOpen(false);
    setEditingShortcut(undefined);
  };

  return (
    <div className="w-full flex flex-col justify-start items-start mt-3 px-1 h-auto shrink-0 flex-nowrap">
      <div className="flex flex-row justify-between items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
        <span>{t("common.shortcuts")}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <PlusIcon className="w-4 h-auto cursor-pointer" onClick={handleCreateShortcut} />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("common.create")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
        {shortcuts.map((shortcut) => {
          const shortcutId = getShortcutId(shortcut.name);
          const maybeEmoji = shortcut.title.split(" ")[0];
          const emoji = emojiRegex.test(maybeEmoji) ? maybeEmoji : undefined;
          const title = emoji ? shortcut.title.replace(emoji, "") : shortcut.title;
          const selected = selectedShortcut === shortcutId;
          return (
            <div
              key={shortcutId}
              className="shrink-0 w-full text-sm rounded-md leading-6 flex flex-row justify-between items-center select-none gap-2 text-muted-foreground"
            >
              <span
                className={cn("truncate cursor-pointer text-muted-foreground", selected && "text-primary font-medium")}
                onClick={() => (selected ? setShortcut(undefined) : setShortcut(shortcutId))}
              >
                {emoji && <span className="text-base mr-1">{emoji}</span>}
                {title.trim()}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <MoreVerticalIcon className="w-4 h-auto shrink-0 text-muted-foreground cursor-pointer hover:text-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" alignOffset={-12}>
                  <DropdownMenuItem onClick={() => handleEditShortcut(shortcut)}>
                    <Edit3Icon className="w-4 h-auto" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDeleteShortcut(shortcut)}>
                    <TrashIcon className="w-4 h-auto" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      <CreateShortcutDialog
        open={isCreateShortcutDialogOpen}
        onOpenChange={setIsCreateShortcutDialogOpen}
        shortcut={editingShortcut}
        onSuccess={handleShortcutDialogSuccess}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.shortcut.delete-confirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteShortcut}
        confirmVariant="destructive"
      />
    </div>
  );
}

export default ShortcutsSection;
