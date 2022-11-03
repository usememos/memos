interface Profile {
  mode: string;
  version: string;
}

interface SystemStatus {
  host: User;
  profile: Profile;
  // System settings
  allowSignUp: boolean;
}

interface SystemSetting {
  name: string;
  value: string;
}
