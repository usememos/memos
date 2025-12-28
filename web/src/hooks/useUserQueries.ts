import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authServiceClient, shortcutServiceClient, userServiceClient } from "@/connect";
import { buildUserSettingName } from "@/helpers/resource-names";
import { User, UserSetting, UserSetting_GeneralSetting, UserSetting_Key, UserSettingSchema } from "@/types/proto/api/v1/user_service_pb";

// Query keys factory
export const userKeys = {
  all: ["users"] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (name: string) => [...userKeys.details(), name] as const,
  stats: () => [...userKeys.all, "stats"] as const,
  userStats: (name: string) => [...userKeys.stats(), name] as const,
  currentUser: () => [...userKeys.all, "current"] as const,
  shortcuts: () => [...userKeys.all, "shortcuts"] as const,
  notifications: () => [...userKeys.all, "notifications"] as const,
  byNames: (names: string[]) => [...userKeys.all, "byNames", ...names.sort()] as const,
};

// NOTE: This hook is currently UNUSED in favor of the AuthContext-based
// useCurrentUser hook (src/hooks/useCurrentUser.ts). This is kept for potential
// future migration to React Query for auth state.
export function useCurrentUserQuery() {
  return useQuery({
    queryKey: userKeys.currentUser(),
    queryFn: async () => {
      const { user } = await authServiceClient.getCurrentUser({});
      return user;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - auth doesn't change often
  });
}

export function useUser(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.detail(name),
    queryFn: async () => {
      const user = await userServiceClient.getUser({ name });
      return user;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes - user profiles don't change often
  });
}

export function useUserStats(username?: string) {
  return useQuery({
    queryKey: username ? userKeys.userStats(username) : userKeys.stats(),
    queryFn: async () => {
      if (!username) {
        throw new Error("Username is required");
      }
      const stats = await userServiceClient.getUserStats({ name: username });
      return stats;
    },
    enabled: !!username,
  });
}

export function useShortcuts() {
  return useQuery({
    queryKey: userKeys.shortcuts(),
    queryFn: async () => {
      const { shortcuts } = await shortcutServiceClient.listShortcuts({});
      return shortcuts;
    },
  });
}

export function useNotifications() {
  const { data: currentUser } = useCurrentUserQuery();

  return useQuery({
    queryKey: userKeys.notifications(),
    queryFn: async () => {
      if (!currentUser?.name) {
        return [];
      }
      const { notifications } = await userServiceClient.listUserNotifications({ parent: currentUser.name });
      return notifications;
    },
    enabled: !!currentUser?.name,
    staleTime: 1000 * 30, // 30 seconds - notifications should update frequently
  });
}

export function useTagCounts(forCurrentUser = false) {
  const { data: currentUser } = useCurrentUserQuery();

  return useQuery({
    queryKey: forCurrentUser ? [...userKeys.stats(), "tagCounts", "current"] : [...userKeys.stats(), "tagCounts", "all"],
    queryFn: async () => {
      if (forCurrentUser) {
        // Fetch current user stats only
        if (!currentUser?.name) {
          return {};
        }
        const stats = await userServiceClient.getUserStats({ name: currentUser.name });
        return stats.tagCount || {};
      } else {
        // Fetch all user stats
        const { stats } = await userServiceClient.listAllUserStats({});

        // Aggregate tag counts from all users
        const tagCount: Record<string, number> = {};
        for (const userStats of stats) {
          if (userStats.tagCount) {
            for (const [tag, count] of Object.entries(userStats.tagCount)) {
              tagCount[tag] = (tagCount[tag] || 0) + count;
            }
          }
        }
        return tagCount;
      }
    },
    enabled: !forCurrentUser || !!currentUser?.name,
    staleTime: 1000 * 60 * 2, // 2 minutes - tags don't change frequently
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user, updateMask }: { user: Partial<User>; updateMask: string[] }) => {
      const updatedUser = await userServiceClient.updateUser({
        user: user as User,
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(userKeys.detail(updatedUser.name), updatedUser);
      queryClient.invalidateQueries({ queryKey: userKeys.currentUser() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await userServiceClient.deleteUser({ name });
      return name;
    },
    onSuccess: (name) => {
      queryClient.removeQueries({ queryKey: userKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

// Hook to fetch user settings
export function useUserSettings(parent?: string) {
  return useQuery({
    queryKey: [...userKeys.all, "settings", parent],
    queryFn: async () => {
      if (!parent) return { settings: [], shortcuts: [] };
      const [{ settings }, { shortcuts }] = await Promise.all([
        userServiceClient.listUserSettings({ parent }),
        shortcutServiceClient.listShortcuts({ parent }),
      ]);
      return { settings, shortcuts };
    },
    enabled: !!parent,
  });
}

// Hook to update user setting
export function useUpdateUserSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ setting, updateMask }: { setting: UserSetting; updateMask: string[] }) => {
      const updatedSetting = await userServiceClient.updateUserSetting({
        setting,
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...userKeys.all, "settings"] });
    },
  });
}

// Hook to list all users
export function useListUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: async () => {
      const { users } = await userServiceClient.listUsers({});
      return users;
    },
  });
}

// Hook to update user general setting (convenience wrapper)
export function useUpdateUserGeneralSetting(currentUserName?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ generalSetting, updateMask }: { generalSetting: Partial<UserSetting_GeneralSetting>; updateMask: string[] }) => {
      if (!currentUserName) {
        throw new Error("No current user");
      }

      const settingName = buildUserSettingName(currentUserName, UserSetting_Key.GENERAL);
      const userSetting = create(UserSettingSchema, {
        name: settingName,
        value: {
          case: "generalSetting",
          value: generalSetting as UserSetting_GeneralSetting,
        },
      });

      const updatedSetting = await userServiceClient.updateUserSetting({
        setting: userSetting,
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...userKeys.all, "settings"] });
    },
  });
}

// Hook to fetch multiple users by names (returns Map<name, User>)
export function useUsersByNames(names: string[]) {
  const enabled = names.length > 0;
  const uniqueNames = Array.from(new Set(names));

  return useQuery({
    queryKey: userKeys.byNames(uniqueNames),
    queryFn: async () => {
      const users = await Promise.all(
        uniqueNames.map(async (name) => {
          try {
            const user = await userServiceClient.getUser({ name });
            return { name, user };
          } catch {
            return { name, user: undefined };
          }
        }),
      );

      const userMap = new Map<string, User | undefined>();
      for (const { name, user } of users) {
        userMap.set(name, user);
      }
      return userMap;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - user profiles don't change often
  });
}
