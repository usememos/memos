import { makeAutoObservable } from "mobx";
import { authServiceClient, inboxServiceClient, userServiceClient } from "@/grpcweb";
import { Inbox } from "@/types/proto/api/v1/inbox_service";
import { Shortcut, User, UserSetting } from "@/types/proto/api/v1/user_service";
import workspaceStore from "./workspace";

class LocalState {
  currentUser?: string;
  userSetting?: UserSetting;
  shortcuts: Shortcut[] = [];
  inboxes: Inbox[] = [];
  userMapByName: Record<string, User> = {};

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    Object.assign(this, partial);
  }
}

const userStore = (() => {
  const state = new LocalState();

  const getOrFetchUserByName = async (name: string) => {
    const userMap = state.userMapByName;
    if (userMap[name]) {
      return userMap[name] as User;
    }
    const user = await userServiceClient.getUser({
      name: name,
    });
    state.setPartial({
      userMapByName: {
        ...userMap,
        [name]: user,
      },
    });
    return user;
  };

  const getUserByName = (name: string) => {
    return state.userMapByName[name];
  };

  const fetchUsers = async () => {
    const { users } = await userServiceClient.listUsers({});
    const userMap = state.userMapByName;
    for (const user of users) {
      userMap[user.name] = user;
    }
    state.setPartial({
      userMapByName: userMap,
    });
    return users;
  };

  const updateUser = async (user: Partial<User>, updateMask: string[]) => {
    const updatedUser = await userServiceClient.updateUser({
      user,
      updateMask,
    });
    state.setPartial({
      userMapByName: {
        ...state.userMapByName,
        [updatedUser.name]: updatedUser,
      },
    });
  };

  const deleteUser = async (name: string) => {
    await userServiceClient.deleteUser({ name });
    const userMap = state.userMapByName;
    delete userMap[name];
    state.setPartial({
      userMapByName: userMap,
    });
  };

  const updateUserSetting = async (userSetting: Partial<UserSetting>, updateMask: string[]) => {
    const updatedUserSetting = await userServiceClient.updateUserSetting({
      setting: userSetting,
      updateMask: updateMask,
    });
    state.setPartial({
      userSetting: UserSetting.fromPartial({
        ...state.userSetting,
        ...updatedUserSetting,
      }),
    });
  };

  const fetchShortcuts = async () => {
    if (!state.currentUser) {
      return;
    }

    const { shortcuts } = await userServiceClient.listShortcuts({ parent: state.currentUser });
    state.setPartial({
      shortcuts,
    });
  };

  const fetchInboxes = async () => {
    const { inboxes } = await inboxServiceClient.listInboxes({});
    state.setPartial({
      inboxes,
    });
  };

  const updateInbox = async (inbox: Partial<Inbox>, updateMask: string[]) => {
    const updatedInbox = await inboxServiceClient.updateInbox({
      inbox,
      updateMask,
    });
    state.setPartial({
      inboxes: state.inboxes.map((i) => {
        if (i.name === updatedInbox.name) {
          return updatedInbox;
        }
        return i;
      }),
    });
    return updatedInbox;
  };

  return {
    state,
    getOrFetchUserByName,
    getUserByName,
    fetchUsers,
    updateUser,
    deleteUser,
    updateUserSetting,
    fetchShortcuts,
    fetchInboxes,
    updateInbox,
  };
})();

export const initialUserStore = async () => {
  try {
    const currentUser = await authServiceClient.getAuthStatus({});
    const userSetting = await userServiceClient.getUserSetting({});
    userStore.state.setPartial({
      currentUser: currentUser.name,
      userSetting: UserSetting.fromPartial({
        ...userSetting,
      }),
      userMapByName: {
        [currentUser.name]: currentUser,
      },
    });
    workspaceStore.state.setPartial({
      locale: userSetting.locale,
      appearance: userSetting.appearance,
    });
  } catch {
    // Do nothing.
  }
};

export default userStore;
