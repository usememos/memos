import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { UserSetting_Key } from "@/types/proto/api/v1/user_service_pb";

export const instanceSettingNamePrefix = "instance/settings/";
export const userNamePrefix = "users/";
export const memoNamePrefix = "memos/";
export const identityProviderNamePrefix = "identity-providers/";
export const activityNamePrefix = "activities/";

export const extractUserIdFromName = (name: string) => {
  return name.split(userNamePrefix).pop() || "";
};

export const extractMemoIdFromName = (name: string) => {
  return name.split(memoNamePrefix).pop() || "";
};

export const extractIdentityProviderIdFromName = (name: string) => {
  return parseInt(name.split(identityProviderNamePrefix).pop() || "", 10);
};

// Helper function to convert InstanceSetting_Key enum value to string name
export const getInstanceSettingKeyName = (key: InstanceSetting_Key): string => {
  // TypeScript enum reverse mapping: converts numeric value to string name
  return InstanceSetting_Key[key];
};

// Helper function to build instance setting name from key
export const buildInstanceSettingName = (key: InstanceSetting_Key): string => {
  return `${instanceSettingNamePrefix}${getInstanceSettingKeyName(key)}`;
};

// Helper function to convert UserSetting_Key enum value to string name
export const getUserSettingKeyName = (key: UserSetting_Key): string => {
  // TypeScript enum reverse mapping: converts numeric value to string name
  return UserSetting_Key[key];
};

// Helper function to build user setting name from username and key
export const buildUserSettingName = (username: string, key: UserSetting_Key): string => {
  return `${username}/settings/${getUserSettingKeyName(key)}`;
};

// Helper function to convert Visibility enum value to string name
// Used when building filter expressions that require string enum names instead of numeric values
// Example: visibility in ["PUBLIC", "PROTECTED"] instead of visibility in ["3", "2"]
export const getVisibilityName = (visibility: Visibility): string => {
  // TypeScript enum reverse mapping: converts numeric value to string name
  // e.g., Visibility.PUBLIC (3) -> "PUBLIC"
  const name = Visibility[visibility];
  if (!name) {
    console.warn(`Invalid visibility value: ${visibility}, defaulting to PUBLIC`);
    return "PUBLIC";
  }
  return name;
};
