import { User, User_Role } from "@/types/proto/api/v1/user_service";

export const isSuperUser = (user: User) => {
  return user.role === User_Role.ADMIN || user.role === User_Role.HOST;
};
