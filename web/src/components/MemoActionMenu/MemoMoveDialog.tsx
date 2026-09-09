import { type FormEvent, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { getErrorMessage } from "@/lib/error";
import { extractSpaceUidFromName, getDuplicateSpaceTitles } from "@/lib/space-display";
import { type Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";

const UNASSIGNED = "unassigned";

export default function MemoMoveDialog({ memo, onOpenChange }: { memo: Memo; onOpenChange: (open: boolean) => void }) {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { data: spaces = [], isPending: loadingSpaces, error: spacesError, refetch } = useSpaces(currentUser?.name);
  const { mutateAsync: updateMemo, isPending } = useUpdateMemo();
  const [destination, setDestination] = useState(memo.space || UNASSIGNED);
  const [visibility, setVisibility] = useState(memo.visibility);
  const [error, setError] = useState("");
  const nextSpace = destination === UNASSIGNED ? undefined : destination;
  const duplicateTitles = getDuplicateSpaceTitles(spaces);
  const spaceLabel = (space: (typeof spaces)[number]) =>
    duplicateTitles.has(space.title) ? `${space.title} (${extractSpaceUidFromName(space.name)})` : space.title;
  const selectedSpace = spaces.find((space) => space.name === destination);
  const destinationLabel = nextSpace
    ? selectedSpace
      ? spaceLabel(selectedSpace)
      : extractSpaceUidFromName(nextSpace)
    : t("memo.move.unassigned");
  const visibilityOption = getVisibilityOption(visibility);
  const canSubmit =
    currentUser?.name === memo.creator && (memo.space || undefined) !== nextSpace && (!nextSpace || !!selectedSpace) && !isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    try {
      await updateMemo({
        update: { name: memo.name, space: nextSpace ?? "", visibility },
        updateMask: memo.visibility === Visibility.SPACE || visibility !== memo.visibility ? ["space", "visibility"] : ["space"],
      });
      toast.success(t("memo.move.success"));
      onOpenChange(false);
    } catch (error) {
      setError(getErrorMessage(error));
      void refetch();
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!isPending) onOpenChange(open);
      }}
    >
      <DialogContent size="sm">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("memo.move.title")}</DialogTitle>
            <DialogDescription>{t("memo.move.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="memo-destination">{t("space.current")}</Label>
            <Select
              value={destination}
              disabled={isPending}
              onValueChange={(value) => {
                setDestination(value);
                setError("");
                if (value === UNASSIGNED && visibility === Visibility.SPACE) setVisibility(Visibility.PRIVATE);
              }}
            >
              <SelectTrigger id="memo-destination" className="w-full">
                <SelectValue>{destinationLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t("memo.move.unassigned")}</SelectItem>
                {spaces.map((space) => (
                  <SelectItem key={space.name} value={space.name}>
                    {spaceLabel(space)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingSpaces && <p className="text-xs text-muted-foreground">{t("space.loading")}</p>}
            {spacesError && (
              <div role="alert" className="text-xs text-destructive">
                {t("space.load-error")}{" "}
                <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>
                  {t("search.retry")}
                </Button>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="memo-move-audience">{t("common.visibility")}</Label>
            <Select value={String(visibility)} disabled={isPending} onValueChange={(value) => setVisibility(Number(value))}>
              <SelectTrigger id="memo-move-audience" className="w-full">
                <SelectValue>{visibilityOption && t(visibilityOption.labelKey)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {getAssignableVisibilityOptions({ hasSpacePlacement: !!nextSpace }).map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              {visibility === Visibility.SPACE
                ? t("memo.move.space-audience", { space: destinationLabel })
                : visibilityOption && t(visibilityOption.descriptionKey)}
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{t("memo.move.history")}</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("memo.move.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
