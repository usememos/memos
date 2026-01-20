import { UserMinusIcon, UserPlusIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscribe, useSubscriptions, useUnsubscribe } from "@/hooks/useSubscriptionQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface FollowButtonProps {
  /** The target user's resource name (e.g., "users/123") */
  targetUserName: string;
  /** Optional class name for styling */
  className?: string;
  /** Size variant */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show icon only */
  iconOnly?: boolean;
}

/**
 * A button component that allows the current user to follow/unfollow another user.
 * Automatically hides if viewing own profile or not authenticated.
 */
export function FollowButton({ targetUserName, className, size = "sm", iconOnly = false }: FollowButtonProps) {
  const t = useTranslate();
  const { currentUser } = useAuth();
  const subscribeMutation = useSubscribe();
  const unsubscribeMutation = useUnsubscribe();

  // Get current user's subscriptions to check if already following
  const { data: subscriptionsData } = useSubscriptions(currentUser?.name ?? "", {
    enabled: !!currentUser?.name,
  });

  // Don't show button if not authenticated or viewing own profile
  if (!currentUser || currentUser.name === targetUserName) {
    return null;
  }

  // Check if current user is following the target user
  const isFollowing = subscriptionsData?.subscriptions?.some(
    (sub) => sub.followingUser === currentUser.name && sub.followedUser === targetUserName,
  );

  const isLoading = subscribeMutation.isPending || unsubscribeMutation.isPending;

  const handleClick = async () => {
    try {
      if (isFollowing) {
        await unsubscribeMutation.mutateAsync(targetUserName);
        toast.success(t("subscription.unfollowed"));
      } else {
        await subscribeMutation.mutateAsync(targetUserName);
        toast.success(t("subscription.followed"));
      }
    } catch (error) {
      console.error("Failed to update subscription:", error);
      toast.error(t("subscription.error"));
    }
  };

  if (iconOnly) {
    return (
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={handleClick}
        disabled={isLoading}
        title={isFollowing ? t("subscription.unfollow") : t("subscription.follow")}
      >
        {isFollowing ? <UserMinusIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size={size}
      className={cn("gap-2", className)}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isFollowing ? (
        <>
          <UserMinusIcon className="h-4 w-4" />
          {t("subscription.unfollow")}
        </>
      ) : (
        <>
          <UserPlusIcon className="h-4 w-4" />
          {t("subscription.follow")}
        </>
      )}
    </Button>
  );
}

export default FollowButton;
