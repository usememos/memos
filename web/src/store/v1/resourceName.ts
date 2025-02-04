export const workspaceSettingNamePrefix = "settings/";
export const userNamePrefix = "users/";
export const memoNamePrefix = "memos/";
export const identityProviderNamePrefix = "identityProviders/";
export const activityNamePrefix = "activities/";

export const extractUserIdFromName = (name: string) => {
  return parseInt(name.split(userNamePrefix).pop() || "", 10);
};

export const extractMemoIdFromName = (name: string) => {
  return name.split(memoNamePrefix).pop() || "";
};

export const extractIdentityProviderIdFromName = (name: string) => {
  return parseInt(name.split(identityProviderNamePrefix).pop() || "", 10);
};
