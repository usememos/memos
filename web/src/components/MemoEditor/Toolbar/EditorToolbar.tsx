import { CheckIcon, CornerDownLeftIcon, LoaderIcon } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type Location, Visibility } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { primaryModifierGlyph } from "@/utils/platform";
import { validationService } from "../services";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorToolbarProps } from "../types";
import AudienceMenu from "./AudienceMenu";
import InsertMenu from "./InsertMenu";

/**
 * Save shortcut as key caps, shown in the commit button's tooltip rather than on
 * the button itself so the primary action reads as a plain verb.
 */
const ShortcutKeys: FC = () => (
  <kbd className="inline-flex items-center gap-px rounded-[4px] bg-primary-foreground/20 px-1 py-0.5 font-sans text-2xs leading-none font-medium">
    {primaryModifierGlyph()}
    <CornerDownLeftIcon className="size-2.5" strokeWidth={2.5} />
  </kbd>
);

export const EditorToolbar: FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  memoName,
  parentMemoName,
  space,
  canChooseSpace,
  onAudioRecorderClick,
  viewToggles,
  onInsertImages,
}) => {
  const t = useTranslate();
  const { actions, dispatch } = useEditorContext();
  // Subscribe to narrow/derived slices so typing (which only changes content)
  // doesn't re-render the toolbar or the heavy InsertMenu it hosts. `valid`
  // flips only on empty↔non-empty / loading transitions, not per keystroke.
  const valid = useEditorSelector((s) => validationService.canSave(s).valid);
  const blockedReason = useEditorSelector((s) => validationService.canSave(s).reason);
  const blockedReasonDetail = useEditorSelector((s) => validationService.canSave(s).detail);
  const isSaving = useEditorSelector((s) => s.ui.isLoading.saving);
  const justSaved = useEditorSelector((s) => s.ui.justSaved);
  const isUploading = useEditorSelector((s) => s.ui.isLoading.uploading);
  const location = useEditorSelector((s) => s.metadata.location);
  const visibility = useEditorSelector((s) => s.metadata.visibility);
  // The save transaction is in flight or its confirmation is holding the
  // editor open; either way the toolbar is frozen.
  const committing = isSaving || justSaved;
  const blockedMessage =
    valid || committing
      ? undefined
      : blockedReason
        ? t(blockedReason, blockedReasonDetail ? { url: blockedReasonDetail } : undefined)
        : t("editor.validation.cannot-save");
  // The verb names what the host does with the memo: an existing memo is
  // updated, a reply becomes a comment, and a new memo is simply saved. A memo
  // is stored with a visibility, not posted, so messaging verbs stay out.
  const commitLabel = memoName ? t("common.update") : parentMemoName ? t("editor.comment") : t("editor.save");

  const handleLocationChange = (next?: Location) => {
    dispatch(actions.setMetadata({ location: next }));
  };

  const handleVisibilityChange = (next: Visibility) => {
    dispatch(actions.setMetadata({ visibility: next }));
  };

  const handleSpaceChange = (next?: string) => {
    dispatch(actions.setMetadata({ space: next, ...(!next && visibility === Visibility.SPACE ? { visibility: Visibility.PRIVATE } : {}) }));
  };

  const commitButton = justSaved ? (
    <Button size="sm" disabled>
      {t("editor.saved")}
      <CheckIcon className="size-3.5" strokeWidth={2.5} />
    </Button>
  ) : blockedMessage ? (
    // A disabled button fires no pointer events, so a focusable wrapper hosts the tooltip.
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" tabIndex={0} aria-label={blockedMessage} />}>
        <Button size="sm" disabled>
          {commitLabel}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{blockedMessage}</TooltipContent>
    </Tooltip>
  ) : (
    // The same trigger stays mounted through the save so the button keeps focus;
    // only its tooltip is switched off. Both modifiers save (see
    // buildEditorExtensions), so both are announced.
    <Tooltip disabled={isSaving}>
      <TooltipTrigger render={<Button size="sm" onClick={onSave} disabled={isSaving} aria-keyshortcuts="Meta+Enter Control+Enter" />}>
        {/* While saving, a spinner covers the label in the same grid cell so the button keeps its width. */}
        <span className="grid place-items-center">
          <span className={cn("col-start-1 row-start-1", isSaving && "invisible")}>{commitLabel}</span>
          <LoaderIcon className={cn("col-start-1 row-start-1 size-3.5 animate-spin", !isSaving && "invisible")} strokeWidth={2.5} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="flex items-center gap-1.5">
          {commitLabel}
          <ShortcutKeys />
        </span>
      </TooltipContent>
    </Tooltip>
  );

  return (
    // Every control on this rail is 28px, the same box as the sidebar's compose control and nav pills.
    <div className="flex w-full min-w-0 flex-row items-center justify-between gap-1">
      <div className="flex min-w-0 flex-1 flex-row items-center justify-start gap-1">
        <InsertMenu
          isUploading={isUploading}
          isSaving={committing}
          location={location}
          onLocationChange={handleLocationChange}
          memoName={memoName}
          onAudioRecorderClick={onAudioRecorderClick}
          viewToggles={viewToggles}
          onInsertImages={onInsertImages}
        />
        <AudienceMenu
          value={visibility}
          space={space}
          onChange={handleVisibilityChange}
          onSpaceChange={canChooseSpace ? handleSpaceChange : undefined}
          disabled={committing}
        />
      </div>

      <div className="flex shrink-0 flex-row items-center justify-end gap-1">
        {onCancel && (
          <Button variant="quiet" size="sm" onClick={onCancel} disabled={committing}>
            {t("common.cancel")}
          </Button>
        )}

        {commitButton}
      </div>
    </div>
  );
};
