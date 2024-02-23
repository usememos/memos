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
}

interface SystemStatus {
  host?: User;
  profile: Profile;
  // System settings
  disablePasswordLogin: boolean;
  disablePublicMemos: boolean;
  maxUploadSizeMiB: number;
  customizedProfile: CustomizedProfile;
  storageServiceId: number;
  localStoragePath: string;
  memoDisplayWithUpdatedTs: boolean;
}

interface SystemSetting {
  name: string;
  value: string;
}
