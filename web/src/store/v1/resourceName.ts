export const workspaceSettingNamePrefix = "settings/";
export const userNamePrefix = "users/";
export const memoNamePrefix = "memos/";
export const identityProviderNamePrefix = "identityProviders/";
export const activityNamePrefix = "activities/";

export const extractMemoIdFromName = (name: string) => {
  return parseInt(name.split(memoNamePrefix).pop() || "", 10);
};

export const extractIdentityProviderIdFromName = (name: string) => {
  return parseInt(name.split(identityProviderNamePrefix).pop() || "", 10);
};
