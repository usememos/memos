import { create } from "@bufbuild/protobuf";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateUserSetting } from "@/hooks/useUserQueries";
import { buildUserSettingName } from "@/lib/resource-names";
import { findTagMetadata } from "@/lib/tag";
import {
  UserSetting_Key,
  type UserSetting_TagMetadata_Icon,
  UserSetting_TagMetadataSchema,
  UserSetting_TagsSettingSchema,
  UserSettingSchema,
} from "@/types/proto/api/v1/user_service_pb";

/**
 * Sets (or clears) one tag's icon without disturbing the user's other tag rules.
 *
 * Writes an exact-name rule, which wins the metadata lookup over any regex rule that
 * currently styles the tag; that rule's colour and blur are copied across once so the
 * tag keeps the look it had before it gained an icon. Clearing the icon removes the rule
 * again when nothing else was configured on it, so picking and unpicking leaves no trace.
 */
export const useSetTagIcon = () => {
  const { currentUser, userTagsSetting, refetchSettings } = useAuth();
  const { mutateAsync: updateUserSetting } = useUpdateUserSetting();

  return useCallback(
    async (tag: string, icon: UserSetting_TagMetadata_Icon | undefined) => {
      if (!currentUser) return;

      const current = userTagsSetting?.tags ?? {};
      const inherited = userTagsSetting ? findTagMetadata(tag, userTagsSetting) : undefined;
      const tags = { ...current };
      if (icon || inherited?.backgroundColor || inherited?.blurContent) {
        tags[tag] = create(UserSetting_TagMetadataSchema, {
          backgroundColor: inherited?.backgroundColor,
          blurContent: inherited?.blurContent ?? false,
          icon,
        });
      } else {
        delete tags[tag];
      }

      try {
        await updateUserSetting({
          setting: create(UserSettingSchema, {
            name: buildUserSettingName(currentUser.name, UserSetting_Key.TAGS),
            value: { case: "tagsSetting", value: create(UserSetting_TagsSettingSchema, { tags }) },
          }),
          updateMask: ["tags"],
        });
        await refetchSettings();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
    [currentUser, userTagsSetting, refetchSettings, updateUserSetting],
  );
};
