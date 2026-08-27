import { Code, ConnectError } from "@connectrpc/connect";
import { ChevronDownIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCreateSpace } from "@/hooks/useSpaceQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import type { Space } from "@/types/proto/api/v1/space_service_pb";
import { useTranslate } from "@/utils/i18n";

const SPACE_UID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (space: Space) => void;
  note?: string;
}

function CreateSpaceDialog({ open, onOpenChange, onCreated, note }: Props) {
  const t = useTranslate();
  const currentUserName = useCurrentUser()?.name ?? "";
  const createSpace = useCreateSpace(currentUserName);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spaceUid, setSpaceUid] = useState(() => uuidv4());
  const [showCustomId, setShowCustomId] = useState(false);
  const [spaceUidConflict, setSpaceUidConflict] = useState(false);
  const isSpaceUidValid = SPACE_UID_PATTERN.test(spaceUid);
  const hasSpaceUidError = !isSpaceUidValid || spaceUidConflict;

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setSpaceUid(uuidv4());
      setShowCustomId(false);
      setSpaceUidConflict(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || hasSpaceUidError || createSpace.isPending) {
      return;
    }

    let space: Space;
    try {
      setSpaceUidConflict(false);
      space = await createSpace.mutateAsync({
        title: trimmedTitle,
        description: description.trim() || undefined,
        spaceId: spaceUid,
      });
    } catch (error) {
      if (error instanceof ConnectError && error.code === Code.AlreadyExists) {
        setSpaceUidConflict(true);
        setShowCustomId(true);
      }
      handleError(error, toast.error, { context: "Create space" });
      return;
    }

    toast.success(t("space.create-success"));
    onOpenChange(false);
    onCreated?.(space);
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
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mx-2 px-2 text-muted-foreground"
              aria-expanded={showCustomId}
              aria-controls="space-custom-uid"
              onClick={() => setShowCustomId((visible) => (hasSpaceUidError ? true : !visible))}
            >
              <ChevronDownIcon className={cn("transition-transform", showCustomId && "rotate-180")} />
              {t("space.custom-id-toggle")}
            </Button>
            {showCustomId && (
              <div id="space-custom-uid" className="mt-2 grid gap-2 rounded-md border bg-muted/30 p-3">
                <Label htmlFor="space-uid">{t("space.custom-id-label")}</Label>
                <Input
                  id="space-uid"
                  value={spaceUid}
                  onChange={(event) => {
                    setSpaceUid(event.target.value);
                    setSpaceUidConflict(false);
                  }}
                  maxLength={36}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={hasSpaceUidError}
                  aria-describedby="space-uid-help"
                  className="font-mono text-xs aria-invalid:border-destructive"
                />
                <p
                  id="space-uid-help"
                  role={hasSpaceUidError ? "alert" : undefined}
                  className={cn("text-xs leading-5", hasSpaceUidError ? "text-destructive" : "text-muted-foreground")}
                >
                  {t(!isSpaceUidValid ? "space.custom-id-invalid" : spaceUidConflict ? "space.custom-id-conflict" : "space.custom-id-help")}
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{note ?? t("space.creator-admin-note")}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={createSpace.isPending} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || hasSpaceUidError || createSpace.isPending}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSpaceDialog;
