import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { shortcutServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { handleError } from "@/lib/error";
import { Shortcut, ShortcutSchema } from "@/types/proto/api/v1/shortcut_service_pb";
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
  const { refetchSettings } = useAuth();
  const [shortcut, setShortcut] = useState<Shortcut>(
    create(ShortcutSchema, {
      name: initialShortcut?.name || "",
      title: initialShortcut?.title || "",
      filter: initialShortcut?.filter || "",
    }),
  );
  const requestState = useLoading(false);
  const isCreating = shortcut.name === "";

  useEffect(() => {
    setShortcut(
      create(ShortcutSchema, {
        name: initialShortcut?.name || "",
        title: initialShortcut?.title || "",
        filter: initialShortcut?.filter || "",
      }),
    );
  }, [initialShortcut]);

  const onShortcutTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      title: e.target.value,
    });
  };

  const onShortcutFilterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPartialState({
      filter: e.target.value,
    });
  };

  const setPartialState = (partialState: Partial<Shortcut>) => {
    setShortcut({
      ...shortcut,
      ...partialState,
    });
  };

  const handleSaveBtnClick = async () => {
    if (!shortcut.title || !shortcut.filter) {
      toast.error("Title and filter cannot be empty");
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        await shortcutServiceClient.createShortcut({
          parent: user?.name,
          shortcut: {
            name: "",
            title: shortcut.title,
            filter: shortcut.filter,
          },
        });
        toast.success("Create shortcut successfully");
      } else {
        await shortcutServiceClient.updateShortcut({
          shortcut: {
            ...shortcut,
            name: initialShortcut!.name,
          },
          updateMask: create(FieldMaskSchema, { paths: ["title", "filter"] }),
        });
        toast.success("Update shortcut successfully");
      }
      await refetchSettings();
      requestState.setFinish();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: isCreating ? "Create shortcut" : "Update shortcut",
        onError: () => requestState.setError(),
      });
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
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateShortcutDialog;
