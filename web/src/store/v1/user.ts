import { create } from "zustand";
import * as api from "@/helpers/api";
import { convertResponseModelUser } from "../module";

interface UserV1Store {
  userMapByUsername: Record<string, User>;
  getOrFetchUserByUsername: (username: string) => Promise<User>;
  getUserByUsername: (username: string) => User;
}

const useUserV1Store = create<UserV1Store>()((set, get) => ({
  userMapByUsername: {},
  getOrFetchUserByUsername: async (username: string) => {
    const userMap = get().userMapByUsername;
    if (userMap[username]) {
      return userMap[username] as User;
    }

    const { data } = await api.getUserByUsername(username);
    const user = convertResponseModelUser(data);
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
