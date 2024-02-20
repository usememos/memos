export const WorkspaceSettingPrefix = "settings/";
export const UserNamePrefix = "users/";
export const MemoNamePrefix = "memos/";

export const extractUsernameFromName = (name: string = "") => {
  return name.slice(UserNamePrefix.length);
};
