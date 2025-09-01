import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { shortcutServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { userStore } from "@/store";
import { Shortcut } from "@/types/proto/api/v1/shortcut_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut?: Shortcut;
  onSuccess?: () => void;
}

function CreateShortcutDialog({ open, onOpenChange, shortcut: initialShortcut, onSuccess }: Props) {
  const t = useTranslate();
  const user = useCurrentUser();
  const [shortcut, setShortcut] = useState<Shortcut>({
    name: initialShortcut?.name || "",
    title: initialShortcut?.title || "",
    filter: initialShortcut?.filter || "",
  });
  const requestState = useLoading(false);
  const isCreating = !initialShortcut;

  useEffect(() => {
    if (initialShortcut) {
      setShortcut({
        name: initialShortcut.name,
        title: initialShortcut.title,
        filter: initialShortcut.filter,
      });
    } else {
      setShortcut({ name: "", title: "", filter: "" });
    }
  }, [initialShortcut]);

  const onShortcutTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShortcut({ ...shortcut, title: e.target.value });
  };

  const onShortcutFilterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setShortcut({ ...shortcut, filter: e.target.value });
  };

  const handleConfirm = async () => {
    if (!shortcut.title || !shortcut.filter) {
      toast.error("Title and filter cannot be empty");
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        await shortcutServiceClient.createShortcut({
          parent: user.name,
          shortcut: {
            name: "", // Will be set by server
            title: shortcut.title,
            filter: shortcut.filter,
          },
        });
        toast.success("Create shortcut successfully");
      } else {
        await shortcutServiceClient.updateShortcut({
          shortcut: {
            ...shortcut,
            name: initialShortcut!.name, // Keep the original resource name
          },
          updateMask: ["title", "filter"],
        });
        toast.success("Update shortcut successfully");
      }
      // Refresh shortcuts.
      await userStore.fetchUserSettings();
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
          <DialogTitle>{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.shortcuts")}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t("common.title")}</Label>
            <Input id="title" type="text" placeholder="" value={shortcut.title} onChange={onShortcutTitleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter">{t("common.filter")}</Label>
            <Textarea
              id="filter"
              rows={3}
              placeholder={t("common.shortcut-filter")}
              value={shortcut.filter}
              onChange={onShortcutFilterChange}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">{t("common.learn-more")}:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <a
                  className="text-primary hover:underline"
                  href="https://www.usememos.com/docs/guides/shortcuts"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Docs - Shortcuts
                </a>
              </li>
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

export default CreateShortcutDialog;
