import { describe, expect, it } from "vitest";
import { User, User_Role } from "@/types/proto/api/v1/user_service_pb";
import { canManageMemo } from "@/utils/user";

const user = (name: string, role: User_Role) => ({ name, role }) as User;

describe("canManageMemo", () => {
  const memo = { creator: "users/alice" };

  it("allows the creator", () => {
    expect(canManageMemo(memo, user("users/alice", User_Role.USER))).toBe(true);
  });

  it("allows an instance admin as superuser", () => {
    expect(canManageMemo(memo, user("users/root", User_Role.ADMIN))).toBe(true);
  });

  it("denies other users and anonymous viewers", () => {
    expect(canManageMemo(memo, user("users/bob", User_Role.USER))).toBe(false);
    expect(canManageMemo(memo, undefined)).toBe(false);
  });
});
