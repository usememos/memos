interface Profile {
  mode: string;
  version: string;
}

interface CustomizedProfile {
  name: string;
  logoUrl: string;
  description: string;
  locale: Locale;
  appearance: Appearance;
  externalUrl: string;
}

interface OpenAIConfig {
  key: string;
  host: string;
}

interface SystemStatus {
  host?: User;
  profile: Profile;
  dbSize: number;
  // System settings
  allowSignUp: boolean;
  ignoreUpgrade: boolean;
  disablePublicMemos: boolean;
  additionalStyle: string;
  additionalScript: string;
  customizedProfile: CustomizedProfile;
  storageServiceId: number;
  localStoragePath: string;
  openAIConfig: OpenAIConfig;
}

interface SystemSetting {
  name: string;
  value: string;
}
