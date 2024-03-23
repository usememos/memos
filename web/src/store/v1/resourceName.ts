export const WorkspaceSettingPrefix = "settings/";
export const UserNamePrefix = "users/";
export const MemoNamePrefix = "memos/";

export const extractMemoIdFromName = (name: string) => {
  return parseInt(name.split(MemoNamePrefix).pop() || "", 10);
};
