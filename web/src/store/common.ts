export const workspaceSettingNamePrefix = "workspace/settings/";
export const userNamePrefix = "users/";
export const memoNamePrefix = "memos/";
export const identityProviderNamePrefix = "identityProviders/";
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
