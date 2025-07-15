import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { memoServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: string;
  onSuccess?: () => void;
}

function RenameTagDialog({ open, onOpenChange, tag, onSuccess }: Props) {
  const t = useTranslate();
  const [newName, setNewName] = useState(tag);
  const requestState = useLoading(false);

  const handleTagNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value.trim());
  };

  const handleConfirm = async () => {
    if (!newName || newName.includes(" ")) {
      toast.error(t("tag.rename-error-empty"));
      return;
    }
    if (newName === tag) {
      toast.error(t("tag.rename-error-repeat"));
      return;
    }

    try {
      requestState.setLoading();
      await memoServiceClient.renameMemoTag({
        parent: "memos/-",
        oldTag: tag,
        newTag: newName,
      });
      toast.success(t("tag.rename-success"));
      requestState.setFinish();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
      requestState.setError();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tag.rename-tag")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="oldName">{t("tag.old-name")}</Label>
            <Input id="oldName" readOnly disabled type="text" value={tag} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newName">{t("tag.new-name")}</Label>
            <Input id="newName" type="text" placeholder="A new tag name" value={newName} onChange={handleTagNameInputChange} />
          </div>
          <div className="text-sm text-muted-foreground">
            <ul className="list-disc list-inside">
              <li>{t("tag.rename-tip")}</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RenameTagDialog;
