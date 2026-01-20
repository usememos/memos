import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { useSubscriptions } from "@/hooks/useSubscriptionQueries";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import FollowButton from "./FollowButton";

interface SubscriptionListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user whose subscriptions to display */
  userName: string;
  /** Which tab to show initially */
  initialTab?: "followers" | "following";
}

interface UserItemProps {
  userName: string;
  onClose: () => void;
}

/**
 * Displays a single user item in the subscription list.
 */
function UserItem({ userName, onClose }: UserItemProps) {
  const { data: user, isLoading } = useUser(userName, { enabled: !!userName });

  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-3 p-3 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded mt-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
      <Link to={`/u/${user.username}`} onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
        <UserAvatar className="h-10 w-10 rounded-full shrink-0" avatarUrl={user.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{user.displayName || user.username}</p>
          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
        </div>
      </Link>
      <FollowButton targetUserName={user.name} size="sm" />
    </div>
  );
}

/**
 * A dialog that displays a user's followers and following lists.
 */
export function SubscriptionListDialog({ open, onOpenChange, userName, initialTab = "followers" }: SubscriptionListDialogProps) {
  const t = useTranslate();
  const [activeTab, setActiveTab] = useState<"followers" | "following">(initialTab);
  const { data: subscriptionsData, isLoading } = useSubscriptions(userName, { enabled: open });

  // Separate followers and following from the subscriptions
  const { followers, following } = useMemo(() => {
    if (!subscriptionsData?.subscriptions) {
      return { followers: [], following: [] };
    }

    const followersSet = new Set<string>();
    const followingSet = new Set<string>();

    for (const sub of subscriptionsData.subscriptions) {
      // If this user is being followed (they are the followedUser), the follower is followingUser
      if (sub.followedUser === userName) {
        followersSet.add(sub.followingUser);
      }
      // If this user is following someone (they are the followingUser), they follow followedUser
      if (sub.followingUser === userName) {
        followingSet.add(sub.followedUser);
      }
    }

    return {
      followers: Array.from(followersSet),
      following: Array.from(followingSet),
    };
  }, [subscriptionsData, userName]);

  const handleClose = () => onOpenChange(false);

  const currentList = activeTab === "followers" ? followers : following;
  const emptyMessage = activeTab === "followers" ? t("subscription.no-followers") : t("subscription.no-following");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("subscription.connections")}</DialogTitle>
        </DialogHeader>

        {/* Custom Tab Implementation */}
        <div className="flex border-b border-border">
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2 px-4 py-2",
              activeTab === "followers"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab("followers")}
          >
            {t("subscription.followers")}
            <span className="ml-2 text-xs text-muted-foreground">({followers.length})</span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2 px-4 py-2",
              activeTab === "following"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab("following")}
          >
            {t("subscription.following")}
            <span className="ml-2 text-xs text-muted-foreground">({following.length})</span>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground animate-pulse">{t("common.loading")}</span>
            </div>
          ) : currentList.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-muted-foreground">{emptyMessage}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {currentList.map((userNameItem) => (
                <UserItem key={userNameItem} userName={userNameItem} onClose={handleClose} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SubscriptionListDialog;
