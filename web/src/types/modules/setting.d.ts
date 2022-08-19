interface Setting {
  locale: Locale;
  memoVisibility: Visibility;
}

interface UserLocaleSetting {
  key: "locale";
  value: Locale;
}

interface UserMemoVisibilitySetting {
  key: "memoVisibility";
  value: Visibility;
}

type UserSetting = UserLocaleSetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
