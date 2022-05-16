declare namespace API {
  interface SystemStatus {
    owner: Model.User;
  }

  interface UserCreate {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }
}
