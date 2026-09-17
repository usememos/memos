import { User, User_Role } from "@/types/proto/api/v1/user_service_pb";

export const isSuperUser = (user: User | undefined) => {
  return user && user.role === User_Role.ADMIN;
};

/**
 * Whether the user holds author-level authority over a memo: its creator, or an
 * instance admin, who is the superuser for named memo operations on the server.
 */
export const canManageMemo = (memo: { creator: string }, user: User | undefined): boolean => {
  return !!user && (memo.creator === user.name || !!isSuperUser(user));
};
