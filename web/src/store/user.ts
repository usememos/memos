import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { uniqueId } from "lodash-es";
import { computed, makeAutoObservable } from "mobx";
import { authServiceClient, shortcutServiceClient, userServiceClient } from "@/connect";
import { Shortcut } from "@/types/proto/api/v1/shortcut_service_pb";
import {
  User,
  UserNotification,
  UserSetting,
  UserSetting_AccessTokensSetting,
  UserSetting_GeneralSetting,
  UserSetting_Key,
  UserSetting_SessionsSetting,
  UserSetting_WebhooksSetting,
  UserSettingSchema,
  UserStats,
} from "@/types/proto/api/v1/user_service_pb";
import { buildUserSettingName } from "./common";
import { createRequestKey, RequestDeduplicator, StoreError } from "./store-utils";

// Helper to extract setting value from UserSetting oneof
function getSettingValue<T>(setting: UserSetting, caseType: string): T | undefined {
  if (setting.value.case === caseType) {
    return setting.value.value as T;
  }
  return undefined;
}

class LocalState {
  currentUser?: string;
  userGeneralSetting?: UserSetting_GeneralSetting;
  userSessionsSetting?: UserSetting_SessionsSetting;
  userAccessTokensSetting?: UserSetting_AccessTokensSetting;
  userWebhooksSetting?: UserSetting_WebhooksSetting;
  shortcuts: Shortcut[] = [];
  notifications: UserNotification[] = [];
  userMapByName: Record<string, User> = {};
  userStatsByName: Record<string, UserStats> = {};

  // The state id of user stats map.
  statsStateId = uniqueId();

  // Computed property that aggregates tag counts across all users (memoized)
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
    // Backend returns stats with key "users/{id}/stats"
    return this.userStatsByName[`${this.currentUser}/stats`];
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

  const updateUser = async (user: Partial<User>, updateMaskPaths: string[]) => {
    const updatedUser = await userServiceClient.updateUser({
      user: user as User,
      updateMask: create(FieldMaskSchema, { paths: updateMaskPaths }),
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

  const updateUserGeneralSetting = async (generalSetting: Partial<UserSetting_GeneralSetting>, updateMaskPaths: string[]) => {
    if (!state.currentUser) {
      throw new Error("No current user");
    }

    const settingName = buildUserSettingName(state.currentUser, UserSetting_Key.GENERAL);
    const userSetting = create(UserSettingSchema, {
      name: settingName,
      value: {
        case: "generalSetting",
        value: generalSetting as UserSetting_GeneralSetting,
      },
    });

    const updatedUserSetting = await userServiceClient.updateUserSetting({
      setting: userSetting,
      updateMask: create(FieldMaskSchema, { paths: updateMaskPaths }),
    });

    state.setPartial({
      userGeneralSetting: getSettingValue<UserSetting_GeneralSetting>(updatedUserSetting, "generalSetting"),
    });
  };

  const getUserGeneralSetting = async () => {
    if (!state.currentUser) {
      throw new Error("No current user");
    }

    const settingName = buildUserSettingName(state.currentUser, UserSetting_Key.GENERAL);
    const userSetting = await userServiceClient.getUserSetting({ name: settingName });
    const generalSetting = getSettingValue<UserSetting_GeneralSetting>(userSetting, "generalSetting");

    state.setPartial({
      userGeneralSetting: generalSetting,
    });

    return generalSetting;
  };

  const fetchUserSettings = async () => {
    if (!state.currentUser) {
      return;
    }

    // Fetch settings and shortcuts in parallel for better performance
    const [{ settings }, { shortcuts }] = await Promise.all([
      userServiceClient.listUserSettings({ parent: state.currentUser }),
      shortcutServiceClient.listShortcuts({ parent: state.currentUser }),
    ]);

    // Extract and store each setting type using the oneof pattern
    const generalSetting = settings.find((s) => s.value.case === "generalSetting");
    const sessionsSetting = settings.find((s) => s.value.case === "sessionsSetting");
    const accessTokensSetting = settings.find((s) => s.value.case === "accessTokensSetting");
    const webhooksSetting = settings.find((s) => s.value.case === "webhooksSetting");

    state.setPartial({
      userGeneralSetting: generalSetting ? getSettingValue<UserSetting_GeneralSetting>(generalSetting, "generalSetting") : undefined,
      userSessionsSetting: sessionsSetting ? getSettingValue<UserSetting_SessionsSetting>(sessionsSetting, "sessionsSetting") : undefined,
      userAccessTokensSetting: accessTokensSetting
        ? getSettingValue<UserSetting_AccessTokensSetting>(accessTokensSetting, "accessTokensSetting")
        : undefined,
      userWebhooksSetting: webhooksSetting ? getSettingValue<UserSetting_WebhooksSetting>(webhooksSetting, "webhooksSetting") : undefined,
      shortcuts: shortcuts,
    });
  };

  // Note: fetchShortcuts is now handled by fetchUserSettings
  // The shortcuts are extracted from the user shortcuts setting

  const fetchNotifications = async () => {
    if (!state.currentUser) {
      throw new Error("No current user available");
    }

    const { notifications } = await userServiceClient.listUserNotifications({
      parent: state.currentUser,
    });

    state.setPartial({
      notifications,
    });
  };

  const updateNotification = async (notification: Partial<UserNotification>, updateMaskPaths: string[]) => {
    const updatedNotification = await userServiceClient.updateUserNotification({
      notification: notification as UserNotification,
      updateMask: create(FieldMaskSchema, { paths: updateMaskPaths }),
    });
    state.setPartial({
      notifications: state.notifications.map((n) => {
        if (n.name === updatedNotification.name) {
          return updatedNotification;
        }
        return n;
      }),
    });
    return updatedNotification;
  };

  const deleteNotification = async (name: string) => {
    await userServiceClient.deleteUserNotification({ name });
    state.setPartial({
      notifications: state.notifications.filter((n) => n.name !== name),
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
          userStatsByName[userStats.name] = userStats; // Use userStats.name as key for consistency
        }
        state.setPartial({
          userStatsByName: {
            ...state.userStatsByName,
            ...userStatsByName,
          },
          statsStateId: uniqueId(), // Update state ID to trigger reactivity
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
    fetchNotifications,
    updateNotification,
    deleteNotification,
    fetchUserStats,
    setStatsStateId,
  };
})();

// Initializes the user store with proper sequencing:
// 1. Fetch current authenticated user session
// 2. Set current user in store (required for subsequent calls)
// 3. Fetch user settings (depends on currentUser being set)
export const initialUserStore = async () => {
  try {
    // Step 1: Authenticate and get current user
    const { user: currentUser } = await authServiceClient.getCurrentSession({});

    if (!currentUser) {
      // No authenticated user - clear state
      userStore.state.setPartial({
        currentUser: undefined,
        userGeneralSetting: undefined,
        userMapByName: {},
      });
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

    // Step 3: Fetch user settings and stats
    // CRITICAL: This must happen after currentUser is set in step 2
    // The fetchUserSettings() and fetchUserStats() methods check state.currentUser internally
    await Promise.all([userStore.fetchUserSettings(), userStore.fetchUserStats()]);
  } catch (error) {
    console.error("Failed to initialize user store:", error);
  }
};

export default userStore;
