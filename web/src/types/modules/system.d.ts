interface Profile {
  mode: string;
  version: string;
}

interface SystemStatus {
  owner: User;
  profile: Profile;
}
