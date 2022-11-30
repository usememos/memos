interface Setting {
  locale: Locale;
  memoVisibility: Visibility;
  memoDisplayTsOption: "created_ts" | "updated_ts";
}

interface LocalSetting {
  isFoldingEnabled: boolean;
}

interface UserLocaleSetting {
  key: "locale";
  value: Locale;
}

interface UserMemoVisibilitySetting {
  key: "memoVisibility";
  value: Visibility;
}

type UserSetting = UserLocaleSetting | UserMemoVisibilitySetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
