declare namespace API {
  interface SystemStatus {
    owner: Model.User;
    profile: Profile;
  }

  interface UserCreate {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }
}
