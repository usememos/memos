type UserId = number;
type UserRole = "HOST" | "USER";

interface User {
  id: UserId;

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

interface UserCreate {
  username: string;
  password: string;
  role: UserRole;
}

interface UserPatch {
  id: UserId;
  rowStatus?: RowStatus;
  username?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  password?: string;
}

interface UserDelete {
  id: UserId;
}
