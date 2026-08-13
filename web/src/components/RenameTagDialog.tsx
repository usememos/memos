import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameMemoTag } from "@/hooks/useMemoQueries";
import { getErrorMessage } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";
import { scanTagAt } from "@/utils/tag-grammar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: string;
  usedCount: number;
  onSuccess?: (updatedMemoCount: number) => void;
}

// Mirrors the backend tag parser rules via the shared tag grammar.
function isValidNewTag(name: string): boolean {
  if (name.length === 0 || name.startsWith("#")) return false;
  const source = `#${name}`;
  const match = scanTagAt(source, 0);
  return match?.to === source.length && match.value === name;
}

function RenameTagDialog({ open, onOpenChange, tag, usedCount, onSuccess }: Props) {
  const t = useTranslate();
  const renameMemoTag = useRenameMemoTag();
  const [newTagName, setNewTagName] = useState("");

  const trimmedNewTag = newTagName.trim();
  const isUnchanged = trimmedNewTag === tag;
  const isEmpty = trimmedNewTag.length === 0;
  const isInvalid = !isEmpty && !isValidNewTag(trimmedNewTag);
  const canSubmit = !isEmpty && !isUnchanged && !isInvalid && !renameMemoTag.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (renameMemoTag.isPending) {
      return;
    }
    if (!nextOpen) {
      setNewTagName("");
      renameMemoTag.reset();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    try {
      const response = await renameMemoTag.mutateAsync({ oldTag: tag, newTag: trimmedNewTag });
      setNewTagName("");
      onOpenChange(false);
      onSuccess?.(response.updatedMemoCount);
    } catch {
      // The error is surfaced below; keep the dialog open for retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("setting.tags.rename-title")}</DialogTitle>
          <DialogDescription>
            {t("setting.tags.rename-description", {
              count: usedCount,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">{t("setting.tags.rename-current-tag")}</span>
            <span className="inline-flex w-fit items-center rounded-md bg-secondary px-2 py-1 font-mono text-sm text-secondary-foreground">
              #{tag}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-tag-new-name">{t("setting.tags.rename-new-tag")}</Label>
            <Input
              id="rename-tag-new-name"
              className="font-mono"
              placeholder={t("setting.tags.rename-new-tag-placeholder")}
              value={newTagName}
              disabled={renameMemoTag.isPending}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              autoFocus
            />
            {renameMemoTag.isError && (
              <p role="alert" className="text-destructive text-xs">
                {getErrorMessage(renameMemoTag.error)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={renameMemoTag.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {renameMemoTag.isPending ? t("common.renaming") : t("setting.tags.rename-submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RenameTagDialog;
