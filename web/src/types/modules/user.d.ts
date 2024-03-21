type UserRole = "HOST" | "USER";

interface User {
  id: number;

  createdTs: number;
  updatedTs: number;

  username: string;
  role: UserRole;
  email: string;
  nickname: string;
  avatarUrl: string;
}
