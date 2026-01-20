import { useState } from "react";
import { useSubscriptionCounts } from "@/hooks/useSubscriptionQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import SubscriptionListDialog from "./SubscriptionListDialog";

interface SubscriptionStatsProps {
  /** The user's resource name (e.g., "users/123") */
  userName: string;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Displays follower and following counts for a user.
 * Clicking on the counts opens a dialog showing the list of users.
 */
export function SubscriptionStats({ userName, className }: SubscriptionStatsProps) {
  const t = useTranslate();
  const { data: counts, isLoading } = useSubscriptionCounts(userName);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"followers" | "following">("followers");

  const handleFollowersClick = () => {
    setDialogTab("followers");
    setDialogOpen(true);
  };

  const handleFollowingClick = () => {
    setDialogTab("following");
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-4 text-sm text-muted-foreground", className)}>
        <span className="animate-pulse">...</span>
      </div>
    );
  }

  return (
    <>
      <div className={cn("flex items-center gap-4 text-sm", className)}>
        <button
          type="button"
          onClick={handleFollowersClick}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <span className="font-semibold text-foreground">{counts?.followerCount ?? 0}</span>
          <span className="text-muted-foreground">{t("subscription.followers")}</span>
        </button>
        <button
          type="button"
          onClick={handleFollowingClick}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <span className="font-semibold text-foreground">{counts?.followingCount ?? 0}</span>
          <span className="text-muted-foreground">{t("subscription.following")}</span>
        </button>
      </div>

      <SubscriptionListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userName={userName}
        initialTab={dialogTab}
      />
    </>
  );
}

export default SubscriptionStats;
