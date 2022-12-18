interface Profile {
  mode: string;
  version: string;
}

interface CustomizedProfile {
  name: string;
  iconUrl: string;
  externalUrl: string;
}

interface SystemStatus {
  host?: User;
  profile: Profile;
  dbSize: number;
  // System settings
  allowSignUp: boolean;
  additionalStyle: string;
  additionalScript: string;
  customizedProfile: CustomizedProfile;
}

interface SystemSetting {
  name: string;
  value: string;
}
