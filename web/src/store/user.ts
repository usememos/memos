import { uniqueId } from "lodash-es";
import { makeAutoObservable, computed } from "mobx";
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
import { RequestDeduplicator, createRequestKey, StoreError } from "./store-utils";
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

  /**
   * Computed property that aggregates tag counts across all users.
   * Uses @computed to memoize the result and only recalculate when userStatsByName changes.
   * This prevents unnecessary recalculations on every access.
   */
  get tagCount() {
    return computed(() => {
      const tagCount: Record<string, number> = {};
      for (const stats of Object.values(this.userStatsByName)) {
        for (const tag of Object.keys(stats.tagCount)) {
          tagCount[tag] = (tagCount[tag] || 0) + stats.tagCount[tag];
        }
      }
      return tagCount;
    }).get();
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
  const deduplicator = new RequestDeduplicator();

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
    // Use GetUser with username - supports both "users/{id}" and "users/{username}"
    const user = await userServiceClient.getUser({
      name: `users/${username}`,
    });
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
    const requestKey = createRequestKey("fetchUsers");
    return deduplicator.execute(requestKey, async () => {
      try {
        const { users } = await userServiceClient.listUsers({});
        const userMap = state.userMapByName;
        for (const user of users) {
          userMap[user.name] = user;
        }
        state.setPartial({
          userMapByName: userMap,
        });
        return users;
      } catch (error) {
        throw StoreError.wrap("FETCH_USERS_FAILED", error);
      }
    });
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
    const requestKey = createRequestKey("fetchUserStats", { user });
    return deduplicator.execute(requestKey, async () => {
      try {
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
      } catch (error) {
        throw StoreError.wrap("FETCH_USER_STATS_FAILED", error);
      }
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

/**
 * Initializes the user store with proper sequencing to avoid temporal coupling.
 *
 * Initialization steps (order is critical):
 * 1. Fetch current authenticated user session
 * 2. Set current user in store (required for subsequent calls)
 * 3. Fetch user settings (depends on currentUser being set)
 * 4. Apply user preferences to workspace store
 *
 * @throws Never - errors are handled internally with fallback behavior
 */
export const initialUserStore = async () => {
  try {
    // Step 1: Authenticate and get current user
    const { user: currentUser } = await authServiceClient.getCurrentSession({});

    if (!currentUser) {
      // No authenticated user - clear state and use default locale
      userStore.state.setPartial({
        currentUser: undefined,
        userGeneralSetting: undefined,
        userMapByName: {},
      });

      const locale = findNearestMatchedLanguage(navigator.language);
      workspaceStore.state.setPartial({ locale });
      return;
    }

    // Step 2: Set current user in store
    // CRITICAL: This must happen before fetchUserSettings() is called
    // because fetchUserSettings() depends on state.currentUser being set
    userStore.state.setPartial({
      currentUser: currentUser.name,
      userMapByName: {
        [currentUser.name]: currentUser,
      },
    });

    // Step 3: Fetch user settings
    // CRITICAL: This must happen after currentUser is set in step 2
    // The fetchUserSettings() method checks state.currentUser internally
    await userStore.fetchUserSettings();

    // Step 4: Apply user preferences to workspace
    // CRITICAL: This must happen after fetchUserSettings() completes
    // We need userGeneralSetting to be populated before accessing it
    const generalSetting = userStore.state.userGeneralSetting;
    if (generalSetting) {
      // Note: setPartial will validate theme automatically
      workspaceStore.state.setPartial({
        locale: generalSetting.locale,
        theme: generalSetting.theme || "default", // Validation handled by setPartial
      });
    } else {
      // Fallback if settings weren't loaded
      const locale = findNearestMatchedLanguage(navigator.language);
      workspaceStore.state.setPartial({ locale });
    }
  } catch (error) {
    // On any error, fall back to browser language detection
    console.error("Failed to initialize user store:", error);
    const locale = findNearestMatchedLanguage(navigator.language);
    workspaceStore.state.setPartial({ locale });
  }
};

export default userStore;
