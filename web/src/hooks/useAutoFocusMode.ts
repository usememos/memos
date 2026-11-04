import { create } from "@bufbuild/protobuf";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateUserEditorSetting } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { UserSetting_EditorSettingSchema } from "@/types/proto/api/user_service_pb";

/** The account-wide preference for automatically entering focus mode. */
export const useAutoFocusMode = (): [boolean, (enabled: boolean) => void] => {
  const { currentUser, userEditorSetting, setUserEditorSetting } = useAuth();
  const { mutate: updateUserEditorSetting } = useUpdateUserEditorSetting(currentUser?.name);
  const enabled = userEditorSetting?.autoFocusMode ?? false;

  const setEnabled = useCallback(
    (next: boolean) => {
      const previous = userEditorSetting?.autoFocusMode ?? false;
      const editorSetting = create(UserSetting_EditorSettingSchema, { autoFocusMode: next });
      setUserEditorSetting((current) => create(UserSetting_EditorSettingSchema, { sourceMode: current?.sourceMode, autoFocusMode: next }));
      updateUserEditorSetting(
        { editorSetting, updateMask: ["auto_focus_mode"] },
        {
          onError: (error) => {
            setUserEditorSetting((current) =>
              create(UserSetting_EditorSettingSchema, { sourceMode: current?.sourceMode, autoFocusMode: previous }),
            );
            handleError(error, toast.error);
          },
        },
      );
    },
    [setUserEditorSetting, updateUserEditorSetting, userEditorSetting],
  );

  return [enabled, setEnabled];
};
