type Appearance = "system" | "light" | "dark";

interface Setting {
  locale: Locale;
  appearance: Appearance;
  memoVisibility: Visibility;
  memoDisplayTsOption: "created_ts" | "updated_ts";
}

interface LocalSetting {
  enableFoldMemo: boolean;
  enablePowerfulEditor: boolean;
}

interface UserLocaleSetting {
  key: "locale";
  value: Locale;
}

interface UserAppearanceSetting {
  key: "appearance";
  value: Appearance;
}

interface UserMemoVisibilitySetting {
  key: "memoVisibility";
  value: Visibility;
}

type UserSetting = UserLocaleSetting | UserAppearanceSetting | UserMemoVisibilitySetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
