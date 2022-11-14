interface Profile {
  mode: string;
  version: string;
}

interface SystemStatus {
  host: User;
  profile: Profile;
  // System settings
  allowSignUp: boolean;
  additionalStyle: string;
  additionalScript: string;
}

interface SystemSetting {
  name: string;
  value: string;
}
