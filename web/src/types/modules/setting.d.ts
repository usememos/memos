type Appearance = "system" | "light" | "dark";

interface BasicSetting {
  locale: Locale;
  appearance: Appearance;
}
interface Setting {
  locale: Locale;
  appearance: Appearance;
  memoVisibility: Visibility;
  telegramUserId: string;
}

interface LocalSetting {
  enableDoubleClickEditing: boolean;
  dailyReviewTimeOffset: number;
  enableAutoCollapse: boolean;
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

interface UserTelegramUserIdSetting {
  key: "telegram-user-id";
  value: string;
}

type UserSetting = UserLocaleSetting | UserAppearanceSetting | UserMemoVisibilitySetting | UserTelegramUserIdSetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
