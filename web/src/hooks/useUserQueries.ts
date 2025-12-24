import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authServiceClient, shortcutServiceClient, userServiceClient } from "@/connect";
import type { User, UserStats } from "@/types/proto/api/v1/user_service_pb";

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
