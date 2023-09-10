import { create } from "zustand";
import * as api from "@/helpers/api";
import { User } from "@/types/proto/api/v2/user_service_pb";

interface UserV1Store {
  userMapByUsername: Record<string, User>;
  getOrFetchUserByUsername: (username: string) => Promise<User>;
  getUserByUsername: (username: string) => User;
}

// Request cache is used to prevent multiple requests.
const requestCache = new Map<string, Promise<any>>();

const useUserV1Store = create<UserV1Store>()((set, get) => ({
  userMapByUsername: {},
  getOrFetchUserByUsername: async (username: string) => {
    const userMap = get().userMapByUsername;
    if (userMap[username]) {
      return userMap[username] as User;
    }
    if (requestCache.has(username)) {
      return await requestCache.get(username);
    }

    const promise = api.getUserByUsername(username);
    requestCache.set(username, promise);
    const {
      data: { user: user },
    } = await promise;
    if (!user) {
      throw new Error("User not found");
    }
    requestCache.delete(username);
    userMap[username] = user;
    set(userMap);
    return user;
  },
  getUserByUsername: (username: string) => {
    const userMap = get().userMapByUsername;
    return userMap[username] as User;
  },
}));

export default useUserV1Store;
