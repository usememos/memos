import type { FC } from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import VisibilitySelector from "../Toolbar/VisibilitySelector";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName }) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { valid } = validationService.canSave(state);

  const isSaving = state.ui.isLoading.saving;

  const handleLocationChange = (location: typeof state.metadata.location) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleVisibilityChange = (visibility: typeof state.metadata.visibility) => {
    dispatch(actions.setMetadata({ visibility }));
  };

  return (
    <div className="w-full flex flex-row justify-between items-center mb-2">
      <div className="flex flex-row justify-start items-center">
        <InsertMenu
          isUploading={state.ui.isLoading.uploading}
          location={state.metadata.location}
          onLocationChange={handleLocationChange}
          onToggleFocusMode={handleToggleFocusMode}
          memoName={memoName}
        />
      </div>

      <div className="flex flex-row justify-end items-center gap-2">
        <VisibilitySelector value={state.metadata.visibility} onChange={handleVisibilityChange} />

        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
        )}

        <Button
          onClick={onSave}
          disabled={!valid || isSaving}
          title={isSaving ? t("editor.saving") : t("editor.save")}
          className="w-[43px] h-[25px] p-0 flex items-center justify-center"
        >
          {isSaving ? (
            <LoaderIcon className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="icon size-8 w-8 h-5 fill-current" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M865.28 202.5472c-17.1008-15.2576-41.0624-19.6608-62.5664-11.5712L177.7664 427.1104c-23.2448 8.8064-38.5024 29.696-39.6288 54.5792-1.1264 24.8832 11.9808 47.104 34.4064 58.0608l97.5872 47.7184c1.9456 0.9216 3.6864 2.2528 5.2224 3.6864 10.1376 26.112 50.176 128.4096 67.9936 165.376 9.0112 18.8416 25.6 32.0512 40.96 37.7856-1.024-0.1024-2.1504-0.3072-3.3792-0.512 2.9696 1.1264 6.0416 2.048 9.216 2.6624 20.2752 4.096 41.0624-2.1504 55.6032-16.7936l36.352-36.352c6.4512-6.4512 16.5888-7.8848 24.576-3.3792l156.5696 88.8832c9.4208 5.3248 19.8656 8.0896 30.3104 8.0896 8.192 0 16.4864-1.6384 24.2688-5.0176 17.8176-7.68 30.72-22.8352 35.4304-41.6768l130.7648-527.1552c5.632-22.1184-1.6384-45.3632-18.7392-60.5184zM314.2656 578.56l335.0528-191.6928L460.1856 580.608c-3.072 3.1744-5.3248 6.7584-6.8608 10.9568-0.1024 0.2048-0.1024 0.3072-0.2048 0.512-0.4096 1.2288-37.7856 111.5136-59.904 161.3824-4.5056-2.9696-9.9328-7.7824-13.1072-14.4384-16.384-34.4064-54.5792-131.7888-65.8432-160.4608z" p-id="1659" fill="currentColor"/>
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
};