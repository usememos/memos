import { type FormEvent, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCreateSpace } from "@/hooks/useSpaceQueries";
import { handleError } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateSpaceDialog({ open, onOpenChange }: Props) {
  const t = useTranslate();
  const currentUserName = useCurrentUser()?.name ?? "";
  const { selectSpace } = useSpaceContext();
  const createSpace = useCreateSpace(currentUserName);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || createSpace.isPending) {
      return;
    }

    try {
      const space = await createSpace.mutateAsync({
        title: trimmedTitle,
        description: description.trim() || undefined,
      });
      selectSpace(space);
      toast.success(t("space.create-success"));
      onOpenChange(false);
    } catch (error) {
      handleError(error, toast.error, { context: "Create space" });
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && createSpace.isPending) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("space.create")}</DialogTitle>
            <DialogDescription>{t("space.create-description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="space-title">{t("common.name")}</Label>
            <Input
              id="space-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("space.name-placeholder")}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="space-description">{t("common.description")}</Label>
            <Textarea
              id="space-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("space.description-placeholder")}
              className="min-h-20 resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("space.creator-admin-note")}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={createSpace.isPending} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || createSpace.isPending}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSpaceDialog;
