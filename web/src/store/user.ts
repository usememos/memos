import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { uniqueId } from "lodash-es";
import { computed, makeAutoObservable } from "mobx";
import { clearAccessToken, setAccessToken } from "@/auth-state";
import { authServiceClient, shortcutServiceClient, userServiceClient } from "@/connect";
import { Shortcut } from "@/types/proto/api/v1/shortcut_service_pb";
import {
  User,
  UserNotification,
  UserSetting,
  UserSetting_GeneralSetting,
  UserSetting_Key,
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

  const getOrFetchUser = async (name: string) => {
    const userMap = state.userMapByName;
    if (userMap[name]) {
      return userMap[name] as User;
    }
    const requestKey = createRequestKey("getOrFetchUser", { name });
    return deduplicator.execute(requestKey, async () => {
      // Double-check cache in case another request finished first
      if (state.userMapByName[name]) {
        return state.userMapByName[name] as User;
      }
      const user = await userServiceClient.getUser({
        name: name,
      });
      state.setPartial({
        userMapByName: {
          ...state.userMapByName,
          [name]: user,
        },
      });
      return user;
    });
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
    const webhooksSetting = settings.find((s) => s.value.case === "webhooksSetting");

    state.setPartial({
      userGeneralSetting: generalSetting ? getSettingValue<UserSetting_GeneralSetting>(generalSetting, "generalSetting") : undefined,
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
    getOrFetchUser,
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
//
// Auth flow:
// - On first call, GetCurrentSession has no access token
// - The interceptor will automatically call RefreshToken using the HttpOnly refresh cookie
// - If refresh succeeds, GetCurrentSession is retried with the new access token
// - If refresh fails (no cookie or expired), user needs to login
export const initialUserStore = async () => {
  try {
    // Step 1: Authenticate and get current user
    // The interceptor will handle token refresh if needed
    const { user: currentUser } = await authServiceClient.getCurrentUser({});

    if (!currentUser) {
      // No authenticated user - clear state
      clearAccessToken();
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
  } catch (error: any) {
    // Auth failed (no refresh token, expired, or other error)
    // Clear state and let user login again
    console.error("Failed to initialize user store:", error);
    clearAccessToken();
    userStore.state.setPartial({
      currentUser: undefined,
      userGeneralSetting: undefined,
      userMapByName: {},
    });
  }
};

// Logout function that clears tokens and state
// This calls DeleteSession which:
// 1. Revokes the refresh token in the database
// 2. Clears both session and refresh token cookies
// We then clear the in-memory access token and reset the store state
export const logout = async () => {
  try {
    await authServiceClient.signOut({});
  } catch (error) {
    // Log error but continue with local cleanup
    console.error("Failed to delete session on server:", error);
  } finally {
    // Always clear local state, even if server call fails
    clearAccessToken();
    userStore.state.setPartial({
      currentUser: undefined,
      userGeneralSetting: undefined,
      userWebhooksSetting: undefined,
      shortcuts: [],
      notifications: [],
      userMapByName: {},
      userStatsByName: {},
    });
  }
};

export default userStore;
