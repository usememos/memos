import { Button, Tooltip } from "@usememos/ui";
import { CircleAlertIcon } from "lucide-react";
import { type FC, useId } from "react";
import { type Location, Visibility } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { primaryModifierGlyph } from "@/utils/platform";
import { validationService } from "../services";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorToolbarProps } from "../types";
import AudienceMenu from "./AudienceMenu";
import InsertMenu from "./InsertMenu";

export const EditorToolbar: FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  memoName,
  parentMemoName,
  space,
  canChooseSpace,
  defaultVisibility,
  onAudioRecorderClick,
  viewToggles,
  sourceMode,
  onInsertImages,
  onDrawingClick,
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
  const drawingSaveError = useEditorSelector((s) => s.drawingSaveError);
  const isUploading = useEditorSelector((s) => s.ui.isLoading.uploading);
  const location = useEditorSelector((s) => s.metadata.location);
  const visibility = useEditorSelector((s) => s.metadata.visibility);
  const blockedMessage =
    valid || isSaving
      ? undefined
      : blockedReason
        ? t(blockedReason, blockedReasonDetail ? { url: blockedReasonDetail } : undefined)
        : t("editor.validation.cannot-save");
  // The verb names what the host does with the memo: an existing memo is
  // updated, a reply becomes a comment, and a new memo is simply saved. A memo
  // is stored with a visibility, not posted, so messaging verbs stay out.
  const commitLabel = memoName ? t("common.update") : parentMemoName ? t("editor.comment") : t("editor.save");
  const loadingLabel = memoName ? t("editor.updating") : parentMemoName ? t("editor.commenting") : t("editor.saving");

  const handleLocationChange = (next?: Location) => {
    dispatch(actions.setMetadata({ location: next }));
  };

  const handleVisibilityChange = (next: Visibility) => {
    dispatch(actions.setMetadata({ visibility: next }));
  };

  const handleSpaceChange = (next?: string) => {
    // A new memo placed in a Space is shared with its members, unless its audience was
    // already changed; an existing memo is moved without touching its audience. Leaving
    // the Space takes the Space audience with it: back to the author's default for a new
    // memo, and to the narrowest audience for an existing one.
    const unplacedVisibility = memoName ? Visibility.PRIVATE : (defaultVisibility ?? Visibility.PRIVATE);
    let nextVisibility: Visibility | undefined;
    if (!next && visibility === Visibility.SPACE) nextVisibility = unplacedVisibility;
    if (next && !memoName && visibility === unplacedVisibility) nextVisibility = Visibility.SPACE;
    dispatch(actions.setMetadata({ space: next, ...(nextVisibility === undefined ? {} : { visibility: nextVisibility }) }));
  };

  const blockedReasonId = useId();
  const commitButton = (
    <Tooltip.Root disabled={isSaving}>
      <Tooltip.Trigger
        render={
          <Button
            variant="primary"
            icon={drawingSaveError ? <CircleAlertIcon /> : undefined}
            onClick={onSave}
            disabled={Boolean(blockedMessage)}
            focusableWhenDisabled
            loading={isSaving}
            loadingLabel={loadingLabel}
            aria-describedby={blockedMessage ? blockedReasonId : undefined}
            aria-keyshortcuts="Meta+Enter Control+Enter"
          />
        }
      >
        {commitLabel}
      </Tooltip.Trigger>
      {/* The save shortcut shows in the tooltip, so the primary action reads as a plain verb. */}
      <Tooltip.Popup side="top" shortcut={blockedMessage ? undefined : `${primaryModifierGlyph()} Enter`}>
        {blockedMessage ?? (drawingSaveError ? t(drawingSaveError) : commitLabel)}
      </Tooltip.Popup>
      {blockedMessage && (
        <span id={blockedReasonId} className="mu-visually-hidden">
          {blockedMessage}
        </span>
      )}
    </Tooltip.Root>
  );

  return (
    // md controls with mu-compact: 14px labels and 16px icons at 28px, the sidebar's height.
    // The portaled menus use the regular md row.
    <div className="mu-compact flex w-full min-w-0 flex-row items-center justify-between gap-1">
      <div className="flex min-w-0 flex-1 flex-row items-center justify-start gap-1">
        <InsertMenu
          isUploading={isUploading}
          isSaving={isSaving}
          location={location}
          onLocationChange={handleLocationChange}
          memoName={memoName}
          onAudioRecorderClick={onAudioRecorderClick}
          viewToggles={viewToggles}
          sourceMode={sourceMode}
          onInsertImages={onInsertImages}
          onDrawingClick={onDrawingClick}
        />
        <AudienceMenu
          value={visibility}
          space={space}
          onChange={handleVisibilityChange}
          onSpaceChange={canChooseSpace ? handleSpaceChange : undefined}
          disabled={isSaving}
        />
      </div>

      <div className="flex shrink-0 flex-row items-center justify-end gap-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
        )}

        {commitButton}
      </div>
    </div>
  );
};
