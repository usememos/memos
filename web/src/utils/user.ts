import { User, User_Role } from "@/types/proto/api/v1/user_service_pb";

export const isSuperUser = (user: User | undefined) => {
  return user && user.role === User_Role.ADMIN;
};
