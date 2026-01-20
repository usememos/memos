import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userServiceClient } from "@/connect";
import { userKeys } from "@/hooks/useUserQueries";

// Query keys factory for subscription cache management
export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  counts: (userName: string) => [...subscriptionKeys.all, "counts", userName] as const,
  list: (userName: string) => [...subscriptionKeys.all, "list", userName] as const,
};

/**
 * Hook to get follower and following counts for a user.
 * Use this to display counts on user profile pages.
 */
export function useSubscriptionCounts(userName: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: subscriptionKeys.counts(userName),
    queryFn: async () => {
      const counts = await userServiceClient.getUserSubscriptionCounts({ name: userName });
      return counts;
    },
    enabled: (options?.enabled ?? true) && !!userName,
    staleTime: 1000 * 60, // 1 minute - counts can be slightly stale
  });
}

/**
 * Hook to list all subscriptions (followers and following) for a user.
 * Returns both followers and following in a single list.
 */
export function useSubscriptions(userName: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: subscriptionKeys.list(userName),
    queryFn: async () => {
      const response = await userServiceClient.listUserSubscriptions({ parent: userName });
      return response;
    },
    enabled: (options?.enabled ?? true) && !!userName,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to subscribe (follow) a user.
 * Invalidates subscription counts and lists on success.
 */
export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userName: string) => {
      await userServiceClient.subscribeUser({ name: userName });
      return userName;
    },
    onSuccess: (userName) => {
      // Invalidate the target user's counts
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.counts(userName) });
      // Invalidate all subscription lists
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      // Invalidate user details (in case we add isFollowing to user response)
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userName) });
    },
  });
}

/**
 * Hook to unsubscribe (unfollow) a user.
 * Invalidates subscription counts and lists on success.
 */
export function useUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userName: string) => {
      await userServiceClient.unsubscribeUser({ name: userName });
      return userName;
    },
    onSuccess: (userName) => {
      // Invalidate the target user's counts
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.counts(userName) });
      // Invalidate all subscription lists
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      // Invalidate user details
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userName) });
    },
  });
}

/**
 * Helper hook to check if the current user is following a specific user.
 * Uses the subscriptions list to determine follow status.
 */
export function useIsFollowing(currentUserName: string, targetUserName: string) {
  const { data: subscriptions } = useSubscriptions(currentUserName, {
    enabled: !!currentUserName && !!targetUserName,
  });

  if (!subscriptions?.subscriptions) {
    return { isFollowing: false, isLoading: true };
  }

  const isFollowing = subscriptions.subscriptions.some(
    (sub) => sub.followingUser === currentUserName && sub.followedUser === targetUserName,
  );

  return { isFollowing, isLoading: false };
}
