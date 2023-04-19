const userData: User = {
  id: 1,
  createdTs: 0 as TimeStamp,
  updatedTs: 0 as TimeStamp,
  rowStatus: "NORMAL" as RowStatus,
  username: "test",
  role: "HOST" as UserRole,
  email: "test@gmail.com",
  nickname: "test user",
  openId: "",
  avatarUrl: "",
  userSettingList: [],
  setting: {
    locale: "en" as Locale,
    appearance: "system" as Appearance,
    memoVisibility: "PUBLIC" as Visibility,
  } as Setting,
  localSetting: {
    enableDoubleClickEditing: true,
    dailyReviewTimeOffset: 1,
    enableAutoCollapse: true,
  } as LocalSetting,
};

export { userData };
