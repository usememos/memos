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
};

// Hook to get current authenticated user
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.currentUser(),
    queryFn: async () => {
      const { user } = await authServiceClient.getCurrentUser({});
      return user;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - auth doesn't change often
  });
}

// Hook to fetch user by name
export function useUser(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.detail(name),
    queryFn: async () => {
      const user = await userServiceClient.getUser({ name });
      return user;
    },
    enabled: options?.enabled ?? true,
  });
}

// Hook to fetch user stats
export function useUserStats(username?: string) {
  return useQuery({
    queryKey: username ? userKeys.userStats(username) : userKeys.stats(),
    queryFn: async () => {
      const name = username ? `${username}/stats` : undefined;
      const stats = await userServiceClient.getUserStats({ name });
      return stats;
    },
    enabled: !!username,
  });
}

// Hook to fetch shortcuts
export function useShortcuts() {
  return useQuery({
    queryKey: userKeys.shortcuts(),
    queryFn: async () => {
      const { shortcuts } = await shortcutServiceClient.listShortcuts({});
      return shortcuts;
    },
  });
}

// Hook to fetch notifications
export function useNotifications() {
  return useQuery({
    queryKey: userKeys.notifications(),
    queryFn: async () => {
      const { notifications } = await userServiceClient.listUserNotifications({});
      return notifications;
    },
  });
}

// Hook to get aggregated tag counts across all users
export function useTagCounts() {
  return useQuery({
    queryKey: [...userKeys.stats(), "tagCounts"],
    queryFn: async () => {
      // Fetch all user stats
      const stats = await userServiceClient.getUserStats({});

      // Aggregate tag counts
      const tagCount: Record<string, number> = {};
      if (stats.tagCount) {
        for (const [tag, count] of Object.entries(stats.tagCount)) {
          tagCount[tag] = (tagCount[tag] || 0) + count;
        }
      }
      return tagCount;
    },
  });
}

// Hook to update user
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

// Hook to delete user
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
