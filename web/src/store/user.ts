import { uniqueId } from "lodash-es";
import { makeAutoObservable } from "mobx";
import { authServiceClient, inboxServiceClient, userServiceClient, shortcutServiceClient } from "@/grpcweb";
import { Inbox } from "@/types/proto/api/v1/inbox_service";
import { Shortcut } from "@/types/proto/api/v1/shortcut_service";
import {
  User,
  UserSetting,
  UserSetting_Key,
  UserSetting_GeneralSetting,
  UserSetting_SessionsSetting,
  UserSetting_AccessTokensSetting,
  UserSetting_WebhooksSetting,
  UserStats,
} from "@/types/proto/api/v1/user_service";
import { findNearestMatchedLanguage } from "@/utils/i18n";
import workspaceStore from "./workspace";

class LocalState {
  currentUser?: string;
  userGeneralSetting?: UserSetting_GeneralSetting;
  userSessionsSetting?: UserSetting_SessionsSetting;
  userAccessTokensSetting?: UserSetting_AccessTokensSetting;
  userWebhooksSetting?: UserSetting_WebhooksSetting;
  shortcuts: Shortcut[] = [];
  inboxes: Inbox[] = [];
  userMapByName: Record<string, User> = {};
  userStatsByName: Record<string, UserStats> = {};

  // The state id of user stats map.
  statsStateId = uniqueId();

  get tagCount() {
    const tagCount: Record<string, number> = {};
    for (const stats of Object.values(this.userStatsByName)) {
      for (const tag of Object.keys(stats.tagCount)) {
        tagCount[tag] = (tagCount[tag] || 0) + stats.tagCount[tag];
      }
    }
    return tagCount;
  }

  get currentUserStats() {
    if (!this.currentUser) {
      return undefined;
    }
    return this.userStatsByName[this.currentUser];
  }

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

  const getOrFetchUserByUsername = async (username: string) => {
    const userMap = state.userMapByName;
    for (const name in userMap) {
      if (userMap[name].username === username) {
        return userMap[name];
      }
    }
    // Use search instead of the deprecated getUserByUsername
    const { users } = await userServiceClient.listUsers({
      filter: `username == "${username}"`,
      pageSize: 10,
    });
    const user = users.find((u) => u.username === username);
    if (!user) {
      throw new Error(`User with username ${username} not found`);
    }
    state.setPartial({
      userMapByName: {
        ...userMap,
        [user.name]: user,
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

  const updateUserGeneralSetting = async (generalSetting: Partial<UserSetting_GeneralSetting>, updateMask: string[]) => {
    if (!state.currentUser) {
      throw new Error("No current user");
    }

    const settingName = `${state.currentUser}/settings/${UserSetting_Key.GENERAL}`;
    const userSetting: UserSetting = {
      name: settingName,
      generalSetting: generalSetting as UserSetting_GeneralSetting,
    };

    const updatedUserSetting = await userServiceClient.updateUserSetting({
      setting: userSetting,
      updateMask: updateMask,
    });

    state.setPartial({
      userGeneralSetting: updatedUserSetting.generalSetting,
    });
  };

  const getUserGeneralSetting = async () => {
    if (!state.currentUser) {
      throw new Error("No current user");
    }

    const settingName = `${state.currentUser}/settings/${UserSetting_Key.GENERAL}`;
    const userSetting = await userServiceClient.getUserSetting({ name: settingName });

    state.setPartial({
      userGeneralSetting: userSetting.generalSetting,
    });

    return userSetting.generalSetting;
  };

  const fetchUserSettings = async () => {
    if (!state.currentUser) {
      return;
    }

    const { settings } = await userServiceClient.listUserSettings({ parent: state.currentUser });
    const { shortcuts } = await shortcutServiceClient.listShortcuts({ parent: state.currentUser });

    // Extract and store each setting type
    const generalSetting = settings.find((s) => s.generalSetting)?.generalSetting;
    const sessionsSetting = settings.find((s) => s.sessionsSetting)?.sessionsSetting;
    const accessTokensSetting = settings.find((s) => s.accessTokensSetting)?.accessTokensSetting;
    const webhooksSetting = settings.find((s) => s.webhooksSetting)?.webhooksSetting;

    state.setPartial({
      userGeneralSetting: generalSetting,
      userSessionsSetting: sessionsSetting,
      userAccessTokensSetting: accessTokensSetting,
      userWebhooksSetting: webhooksSetting,
      shortcuts: shortcuts,
    });
  };

  // Note: fetchShortcuts is now handled by fetchUserSettings
  // The shortcuts are extracted from the user shortcuts setting

  const fetchInboxes = async () => {
    if (!state.currentUser) {
      throw new Error("No current user available");
    }

    const { inboxes } = await inboxServiceClient.listInboxes({
      parent: state.currentUser,
    });

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

  const deleteInbox = async (name: string) => {
    await inboxServiceClient.deleteInbox({ name });
    state.setPartial({
      inboxes: state.inboxes.filter((i) => i.name !== name),
    });
  };

  const fetchUserStats = async (user?: string) => {
    const userStatsByName: Record<string, UserStats> = {};
    if (!user) {
      const { stats } = await userServiceClient.listAllUserStats({});
      for (const userStats of stats) {
        userStatsByName[userStats.name] = userStats;
      }
    } else {
      const userStats = await userServiceClient.getUserStats({ name: user });
      userStatsByName[user] = userStats;
    }
    state.setPartial({
      userStatsByName: {
        ...state.userStatsByName,
        ...userStatsByName,
      },
    });
  };

  const setStatsStateId = (id = uniqueId()) => {
    state.statsStateId = id;
  };

  return {
    state,
    getOrFetchUserByName,
    getOrFetchUserByUsername,
    getUserByName,
    fetchUsers,
    updateUser,
    deleteUser,
    updateUserGeneralSetting,
    getUserGeneralSetting,
    fetchUserSettings,
    fetchInboxes,
    updateInbox,
    deleteInbox,
    fetchUserStats,
    setStatsStateId,
  };
})();

// TODO: refactor initialUserStore as it has temporal coupling
// need to make it more clear that the order of the body is important
// or it leads to false positives
// See: https://github.com/usememos/memos/issues/4978
export const initialUserStore = async () => {
  try {
    const { user: currentUser } = await authServiceClient.getCurrentSession({});
    if (!currentUser) {
      // If no user is authenticated, we can skip the rest of the initialization.
      userStore.state.setPartial({
        currentUser: undefined,
        userGeneralSetting: undefined,
        userMapByName: {},
      });
      return;
    }

    userStore.state.setPartial({
      currentUser: currentUser.name,
      userMapByName: {
        [currentUser.name]: currentUser,
      },
    });

    // must be called after user is set in store
    await userStore.fetchUserSettings();

    // must be run after fetchUserSettings is called.
    // Apply general settings to workspace if available
    const generalSetting = userStore.state.userGeneralSetting;
    if (generalSetting) {
      workspaceStore.state.setPartial({
        locale: generalSetting.locale,
        theme: generalSetting.theme || "default",
      });
    }
  } catch {
    // find the nearest matched lang based on the `navigator.language` if the user is unauthenticated or settings retrieval fails.
    const locale = findNearestMatchedLanguage(navigator.language);
    workspaceStore.state.setPartial({
      locale: locale,
    });
  }
};

export default userStore;
