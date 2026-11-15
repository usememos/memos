import { Code, ConnectError } from "@connectrpc/connect";
import { Button, Dialog, Field, Input, Textarea } from "@usememos/ui";
import { ChevronDownIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import SpaceIconPicker from "@/components/SpaceIconPicker";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCreateSpace } from "@/hooks/useSpaceQueries";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Space, Space_Icon } from "@/types/proto/api/space_service_pb";
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
  const [icon, setIcon] = useState<Space_Icon>();
  const [spaceUid, setSpaceUid] = useState(() => uuidv4());
  const [showCustomId, setShowCustomId] = useState(false);
  const [spaceUidConflict, setSpaceUidConflict] = useState(false);
  const isSpaceUidValid = SPACE_UID_PATTERN.test(spaceUid);
  const hasSpaceUidError = !isSpaceUidValid || spaceUidConflict;

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setIcon(undefined);
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
        ...(icon ? { icon } : {}),
      });
    } catch (error) {
      if (error instanceof ConnectError && error.code === Code.AlreadyExists) {
        setSpaceUidConflict(true);
        setShowCustomId(true);
      }
      handleError(error, showErrorToast, { context: "Create space" });
      return;
    }

    toast.add({ title: t("space.create-success"), type: "success" });
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
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Dialog.Title>{t("space.create")}</Dialog.Title>
          <Dialog.Description>{t("space.create-description")}</Dialog.Description>
          <div className="flex flex-col gap-1">
            <label htmlFor="space-title" className="mu-label">
              {t("common.name")}
            </label>
            <div className="flex items-center gap-2">
              <SpaceIconPicker value={icon} onChange={setIcon} disabled={createSpace.isPending} />
              <Input
                id="space-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("space.name-placeholder")}
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>
          <Field.Root>
            <Field.Label>{t("common.description")}</Field.Label>
            <Textarea
              id="space-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("space.description-placeholder")}
              className="min-h-20 resize-none"
            />
          </Field.Root>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mx-2"
              aria-expanded={showCustomId}
              aria-controls="space-custom-uid"
              onClick={() => setShowCustomId((visible) => (hasSpaceUidError ? true : !visible))}
              icon={<ChevronDownIcon className={cn("transition-transform", showCustomId && "rotate-180")} />}
            >
              {t("space.custom-id-toggle")}
            </Button>
            {showCustomId && (
              <Field.Root id="space-custom-uid" className="mt-2" invalid={hasSpaceUidError}>
                <Field.Label>{t("space.custom-id-label")}</Field.Label>
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
                  className="font-mono"
                />
                <Field.Description>{t("space.custom-id-help")}</Field.Description>
                {hasSpaceUidError && (
                  <Field.Error match role="alert">
                    {t(!isSpaceUidValid ? "space.custom-id-invalid" : "space.custom-id-conflict")}
                  </Field.Error>
                )}
              </Field.Root>
            )}
          </div>
          <p className="mu-caption text-mu-text-secondary">{note ?? t("space.creator-admin-note")}</p>
          <Dialog.Footer>
            <Button type="button" variant="ghost" disabled={createSpace.isPending} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" type="submit" disabled={!title.trim() || hasSpaceUidError || createSpace.isPending}>
              {t("common.create")}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default CreateSpaceDialog;
