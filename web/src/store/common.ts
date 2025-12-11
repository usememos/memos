import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
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
