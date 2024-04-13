export const WorkspaceSettingPrefix = "settings/";
export const UserNamePrefix = "users/";
export const MemoNamePrefix = "memos/";
export const IdentityProviderNamePrefix = "identityProviders/";

export const extractMemoIdFromName = (name: string) => {
  return parseInt(name.split(MemoNamePrefix).pop() || "", 10);
};

export const extractIdentityProviderIdFromName = (name: string) => {
  return parseInt(name.split(IdentityProviderNamePrefix).pop() || "", 10);
};
