type UserId = number;
type UserRole = "HOST" | "USER";

interface User {
  id: UserId;

  createdTs: TimeStamp;
  updatedTs: TimeStamp;
  rowStatus: RowStatus;

  username: string;
  role: UserRole;
  email: string;
  nickname: string;
  openId: string;
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
  password?: string;
  resetOpenId?: boolean;
}

interface UserDelete {
  id: UserId;
}
