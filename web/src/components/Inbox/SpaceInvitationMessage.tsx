import { timestampDate } from "@bufbuild/protobuf/wkt";
import { CheckIcon, TrashIcon, UsersIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import SpaceMark from "@/components/SpaceMark";
import SpaceRoleBadge from "@/components/SpaceRoleBadge";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useAcceptSpaceInvitation, useDeclineSpaceInvitation } from "@/hooks/useSpaceQueries";
import { useArchiveNotification, useDeleteNotification } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import {
  UserNotification,
  UserNotification_SpaceInvitationPayload_State,
  UserNotification_Status,
} from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  notification: UserNotification;
}

function SpaceInvitationMessage({ notification }: Props) {
  const t = useTranslate();
  const archiveNotification = useArchiveNotification();
  const deleteNotification = useDeleteNotification();
  const currentUser = useCurrentUser();
  const viewerName = currentUser?.name ?? "";
  const { selectSpace } = useSpaceContext();
  const acceptInvitation = useAcceptSpaceInvitation(viewerName);
  const declineInvitation = useDeclineSpaceInvitation(viewerName);
  const payload = notification.payload?.case === "spaceInvitation" ? notification.payload.value : undefined;
  const space = payload?.space;
  const sender = notification.senderUser;

  const handleArchiveMessage = async (silence = false) => {
    try {
      await archiveNotification.mutateAsync(notification.name);
      if (!silence) {
        toast.success(t("message.archived-successfully"));
      }
    } catch (error) {
      handleError(error, toast.error, { context: "Archive notification" });
    }
  };

  const handleDeleteMessage = async () => {
    try {
      await deleteNotification.mutateAsync(notification.name);
      toast.success(t("message.deleted-successfully"));
    } catch (error) {
      handleError(error, toast.error, { context: "Delete notification" });
    }
  };

  if (!payload || !space) {
    return (
      <div className="w-full px-5 py-4 border-b border-border/60 last:border-b-0 bg-destructive/[0.04] group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 ring-1 ring-destructive/20">
              <XIcon className="w-5 h-5 text-destructive" strokeWidth={2} />
            </div>
            <span className="text-sm text-destructive/80 font-medium">{t("inbox.failed-to-load")}</span>
          </div>
          <button
            onClick={handleDeleteMessage}
            className="p-1.5 hover:bg-destructive/15 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
            title={t("common.delete")}
          >
            <TrashIcon className="w-4 h-4 text-destructive/70 hover:text-destructive transition-colors" strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  const isUnread = notification.status === UserNotification_Status.UNREAD;
  const isPending = payload.state === UserNotification_SpaceInvitationPayload_State.PENDING;
  const isBusy = acceptInvitation.isPending || declineInvitation.isPending;
  const spaceUid = extractSpaceUidFromName(space.name);
  const spaceLabel = `${space.title} (${spaceUid})`;

  const handleAccept = async () => {
    try {
      await acceptInvitation.mutateAsync({ name: payload.spaceInvitation });
      toast.success(t("setting.spaces.accept-success", { space: spaceLabel }));
    } catch (error) {
      handleError(error, toast.error, { context: "Accept space invitation" });
    }
  };

  const handleDecline = async () => {
    try {
      await declineInvitation.mutateAsync({ name: payload.spaceInvitation });
      toast.success(t("setting.spaces.decline-success"));
    } catch (error) {
      handleError(error, toast.error, { context: "Decline space invitation" });
    }
  };

  const handleOpenSpace = () => {
    selectSpace(space);
  };

  return (
    <div
      className={cn(
        "w-full px-5 py-4 border-b border-border/60 last:border-b-0 transition-all duration-200 group relative",
        isUnread ? "bg-primary/[0.03] hover:bg-primary/[0.05]" : "hover:bg-muted/30",
      )}
    >
      {isUnread && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/60" />}

      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <UserAvatar className="w-10 h-10 ring-1 ring-border/40" avatarUrl={sender?.avatarUrl} />
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center shadow-md transition-all",
              isUnread ? "bg-primary text-primary-foreground" : "bg-muted/80 text-muted-foreground",
            )}
          >
            <UsersIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-semibold text-sm text-foreground/95">{sender?.displayName || sender?.username}</span>
              <span className="text-sm text-muted-foreground/80">{t("inbox.space-invitation")}</span>
              <span className="text-xs text-muted-foreground/60">
                {notification.createTime &&
                  timestampDate(notification.createTime)?.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                at{" "}
                {notification.createTime &&
                  timestampDate(notification.createTime)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isUnread ? (
                <button
                  onClick={() => handleArchiveMessage()}
                  className="p-1.5 hover:bg-primary/10 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title={t("common.archive")}
                >
                  <CheckIcon className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" strokeWidth={2} />
                </button>
              ) : (
                <button
                  onClick={handleDeleteMessage}
                  className="p-1.5 hover:bg-destructive/10 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title={t("common.delete")}
                >
                  <TrashIcon className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SpaceMark size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground/95">{space.title}</span>
                  <span className="text-xs text-muted-foreground/70">{spaceUid}</span>
                  <SpaceRoleBadge role={payload.role} />
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground/80">
                  {isPending ? space.description || t("setting.spaces.invited-to-join") : t("inbox.space-invitation-accepted")}
                </p>
              </div>
            </div>
            {isPending ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={isBusy} onClick={() => void handleDecline()}>
                  {t("setting.spaces.decline")}
                </Button>
                <Button size="sm" disabled={isBusy} onClick={() => void handleAccept()}>
                  {t("setting.spaces.accept")}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleOpenSpace}>
                {t("inbox.space-invitation-open")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpaceInvitationMessage;
