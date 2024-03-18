type UserRole = "HOST" | "USER";

interface User {
  id: number;

  createdTs: number;
  updatedTs: number;
  rowStatus: RowStatus;

  username: string;
  role: UserRole;
  email: string;
  nickname: string;
  avatarUrl: string;
  userSettingList: UserSetting[];

  setting: Setting;
  localSetting: LocalSetting;
}
