import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import VisibilitySelector from "../Toolbar/VisibilitySelector";

interface EditorToolbarProps {
  onSave: () => void;
  onCancel?: () => void;
}

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel }) => {
  const { state, actions } = useEditorContext();
  const { valid } = validationService.canSave(state);

  const isSaving = state.ui.isLoading.saving;

  return (
    <div className="w-full flex flex-row justify-between items-center mb-2">
      <div className="flex flex-row justify-start items-center">
        <InsertMenu
          isUploading={state.ui.isLoading.uploading}
          location={state.metadata.location}
          onLocationChange={(location) => actions.setMetadata({ location })}
          onToggleFocusMode={actions.toggleFocusMode}
        />
      </div>

      <div className="flex flex-row justify-end items-center gap-2">
        <VisibilitySelector value={state.metadata.visibility} onChange={(v) => actions.setMetadata({ visibility: v })} />

        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}

        <Button onClick={onSave} disabled={!valid || isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};
