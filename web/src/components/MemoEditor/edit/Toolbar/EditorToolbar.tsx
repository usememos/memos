import { Button, Tooltip } from "@usememos/ui";
import { CheckIcon } from "lucide-react";
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

  const blockedReasonId = useId();
  const commitButton = justSaved ? (
    <Button variant="primary" iconEnd={<CheckIcon />} disabled>
      {t("editor.saved")}
    </Button>
  ) : blockedMessage ? (
    // The disabled button stays focusable; its tooltip and its description say why it can't save.
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="primary" disabled focusableWhenDisabled aria-describedby={blockedReasonId} />}>
        {commitLabel}
      </Tooltip.Trigger>
      <Tooltip.Popup side="top">{blockedMessage}</Tooltip.Popup>
      <span id={blockedReasonId} className="mu-visually-hidden">
        {blockedMessage}
      </span>
    </Tooltip.Root>
  ) : (
    // The same trigger stays mounted through the save so the button keeps focus;
    // only its tooltip is switched off. Both modifiers save (see
    // buildEditorExtensions), so both are announced.
    <Tooltip.Root disabled={isSaving}>
      <Tooltip.Trigger
        render={
          <Button
            variant="primary"
            onClick={onSave}
            loading={isSaving}
            loadingLabel={commitLabel}
            aria-keyshortcuts="Meta+Enter Control+Enter"
          />
        }
      >
        {commitLabel}
      </Tooltip.Trigger>
      {/* The save shortcut shows in the tooltip, so the primary action reads as a plain verb. */}
      <Tooltip.Popup side="top" shortcut={`${primaryModifierGlyph()} Enter`}>
        {commitLabel}
      </Tooltip.Popup>
    </Tooltip.Root>
  );

  return (
    // md controls with mu-compact: 14px labels and 16px icons at 28px, the sidebar's height.
    // The menus they open are portaled outside, so they stay sm.
    <div className="mu-compact flex w-full min-w-0 flex-row items-center justify-between gap-1">
      <div className="flex min-w-0 flex-1 flex-row items-center justify-start gap-1">
        <InsertMenu
          isUploading={isUploading}
          isSaving={committing}
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
          disabled={committing}
        />
      </div>

      <div className="flex shrink-0 flex-row items-center justify-end gap-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={committing}>
            {t("common.cancel")}
          </Button>
        )}

        {commitButton}
      </div>
    </div>
  );
};
