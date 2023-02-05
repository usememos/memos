type Appearance = "system" | "light" | "dark";

type StorageLocation = "SMMS" | "Database";
interface SMMSConfig {
  token: string;
}

interface StorageConfig {
  imageStorage: StorageLocation;
  othersStorage: StorageLocation;
  smmsConfig: SMMSConfig;
}

interface Setting {
  locale: Locale;
  appearance: Appearance;
  memoVisibility: Visibility;
  memoDisplayTsOption: "created_ts" | "updated_ts";
  storageConfig?: StorageConfig;
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
