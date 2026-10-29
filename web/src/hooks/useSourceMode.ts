import { create } from "@bufbuild/protobuf";
import type { EditorMode } from "@usememos/editor";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateUserEditorSetting } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { UserSetting_EditorSettingSchema } from "@/types/proto/api/user_service_pb";

/**
 * The memo editor's mode, saved to the account's EDITOR setting so every composer on every device shares it.
 * A change applies at once and is reverted if saving it fails.
 */
export const useSourceMode = (): [EditorMode, (mode: EditorMode) => void] => {
  const { currentUser, userEditorSetting, setUserEditorSetting } = useAuth();
  const { mutate: updateUserEditorSetting } = useUpdateUserEditorSetting(currentUser?.name);
  const mode: EditorMode = userEditorSetting?.sourceMode ? "source" : "rich";

  const setMode = useCallback(
    (next: EditorMode) => {
      const previous = userEditorSetting;
      const editorSetting = create(UserSetting_EditorSettingSchema, { sourceMode: next === "source" });
      setUserEditorSetting(editorSetting);
      updateUserEditorSetting(editorSetting, {
        onError: (error) => {
          setUserEditorSetting(previous);
          handleError(error, toast.error);
        },
      });
    },
    [setUserEditorSetting, updateUserEditorSetting, userEditorSetting],
  );

  return [mode, setMode];
};
