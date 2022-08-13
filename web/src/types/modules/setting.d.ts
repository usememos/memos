interface Setting {
  locale: "en" | "zh";
}

interface UserLocaleSetting {
  key: "locale";
  value: "en" | "zh";
}

type UserSetting = UserLocaleSetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
