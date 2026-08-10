import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Location, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorToolbarProps } from "../types";
import InsertMenu from "./InsertMenu";
import VisibilitySelector from "./VisibilitySelector";

export const EditorToolbar: FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  memoName,
  onAudioRecorderClick,
  isFormattingToolbarVisible,
  onToggleFormattingToolbar,
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
  const isUploading = useEditorSelector((s) => s.ui.isLoading.uploading);
  const location = useEditorSelector((s) => s.metadata.location);
  const visibility = useEditorSelector((s) => s.metadata.visibility);
  const blockedMessage = valid
    ? undefined
    : blockedReason
      ? t(blockedReason, blockedReasonDetail ? { url: blockedReasonDetail } : undefined)
      : t("editor.validation.cannot-save");

  const handleLocationChange = (next?: Location) => {
    dispatch(actions.setMetadata({ location: next }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleVisibilityChange = (next: Visibility) => {
    dispatch(actions.setMetadata({ visibility: next }));
  };

  return (
    <div className="w-full flex flex-row justify-between items-center mb-2">
      <div className="flex flex-row justify-start items-center gap-1">
        <InsertMenu
          isUploading={isUploading}
          isSaving={isSaving}
          location={location}
          onLocationChange={handleLocationChange}
          onToggleFocusMode={handleToggleFocusMode}
          memoName={memoName}
          onAudioRecorderClick={onAudioRecorderClick}
          isFormattingToolbarVisible={isFormattingToolbarVisible}
          onToggleFormattingToolbar={onToggleFormattingToolbar}
          onInsertImages={onInsertImages}
        />
        <VisibilitySelector value={visibility} onChange={handleVisibilityChange} />
      </div>

      <div className="flex flex-row justify-end items-center gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
        )}

        {!valid && !isSaving && blockedMessage ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" tabIndex={0} aria-label={blockedMessage} />}>
              <Button onClick={onSave} disabled>
                {t("editor.save")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{blockedMessage}</TooltipContent>
          </Tooltip>
        ) : (
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? t("editor.saving") : t("editor.save")}
          </Button>
        )}
      </div>
    </div>
  );
};
