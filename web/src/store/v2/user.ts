import { makeAutoObservable } from "mobx";
import { authServiceClient, inboxServiceClient, userServiceClient } from "@/grpcweb";
import { Inbox } from "@/types/proto/api/v1/inbox_service";
import { Shortcut, User, UserSetting } from "@/types/proto/api/v1/user_service";

interface LocalState {
  // The name of current user. Format: `users/${uid}`
  currentUser?: string;
  // userSetting is the setting of the current user.
  userSetting?: UserSetting;
  // shortcuts is the list of shortcuts of the current user.
  shortcuts: Shortcut[];
  // inboxes is the list of inboxes of the current user.
  inboxes: Inbox[];
  // userMapByName is used to cache user information.
  // Key is the `user.name` and value is the `User` object.
  userMapByName: Record<string, User>;
}

const userStore = (() => {
  const state = makeAutoObservable<LocalState>({
    shortcuts: [],
    inboxes: [],
    userMapByName: {},
  });

  const getOrFetchUserByName = async (name: string) => {
    const userMap = state.userMapByName;
    if (userMap[name]) {
      return userMap[name] as User;
    }
    const user = await userServiceClient.getUser({
      name: name,
    });
    userMap[name] = user;
    state.userMapByName = userMap;
    return user;
  };

  const updateUser = async (user: Partial<User>, updateMask: string[]) => {
    const updatedUser = await userServiceClient.updateUser({
      user,
      updateMask,
    });
    state.userMapByName = {
      ...state.userMapByName,
      [updatedUser.name]: updatedUser,
    };
  };

  const updateUserSetting = async (userSetting: Partial<UserSetting>, updateMask: string[]) => {
    const updatedUserSetting = await userServiceClient.updateUserSetting({
      setting: userSetting,
      updateMask: updateMask,
    });
    state.userSetting = UserSetting.fromPartial(updatedUserSetting);
  };

  const fetchShortcuts = async () => {
    if (!state.currentUser) {
      return;
    }

    const { shortcuts } = await userServiceClient.listShortcuts({ parent: state.currentUser });
    state.shortcuts = shortcuts;
  };

  const fetchInboxes = async () => {
    const { inboxes } = await inboxServiceClient.listInboxes({});
    state.inboxes = inboxes;
    console.log("inboxes", inboxes);
  };

  const updateInbox = async (inbox: Partial<Inbox>, updateMask: string[]) => {
    const updatedInbox = await inboxServiceClient.updateInbox({
      inbox,
      updateMask,
    });
    state.inboxes = state.inboxes.map((i) => (i.name === updatedInbox.name ? updatedInbox : i));
    return updatedInbox;
  };

  return {
    state,
    getOrFetchUserByName,
    updateUser,
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
    Object.assign(userStore.state, {
      currentUser: currentUser.name,
      userSetting: UserSetting.fromPartial({
        ...userSetting,
      }),
      userMapByName: {
        [currentUser.name]: currentUser,
      },
    });
  } catch {
    // Do nothing.
  }
};

export default userStore;
