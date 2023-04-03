type Appearance = "system" | "light" | "dark";

interface Setting {
  locale: Locale;
  appearance: Appearance;
  memoVisibility: Visibility;
}

interface LocalSetting {
  enableDoubleClickEditing: boolean;
  dailyReviewTimeOffset: number;
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
  key: "memo-visibility";
  value: Visibility;
}

type UserSetting = UserLocaleSetting | UserAppearanceSetting | UserMemoVisibilitySetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
