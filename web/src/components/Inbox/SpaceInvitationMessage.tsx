import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Button } from "@usememos/ui";
import { CheckIcon, TrashIcon, UsersIcon, XIcon } from "lucide-react";
import SpaceMark from "@/components/SpaceMark";
import SpaceRoleBadge from "@/components/SpaceRoleBadge";
import UserAvatar from "@/components/UserAvatar";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useAcceptSpaceInvitation, useDeclineSpaceInvitation } from "@/hooks/useSpaceQueries";
import { useArchiveNotification, useDeleteNotification } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { showErrorToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  UserNotification,
  UserNotification_SpaceInvitationPayload_InvitationState,
  UserNotification_Status,
} from "@/types/proto/api/user_service_pb";
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
        toast.add({ title: t("message.archived-successfully"), type: "success" });
      }
    } catch (error) {
      handleError(error, showErrorToast, { context: "Archive notification" });
    }
  };

  const handleDeleteMessage = async () => {
    try {
      await deleteNotification.mutateAsync(notification.name);
      toast.add({ title: t("message.deleted-successfully"), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Delete notification" });
    }
  };

  if (!payload || !space) {
    return (
      <div className="w-full px-5 py-4 border-b border-mu-line/60 last:border-b-0 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mu-danger-soft flex items-center justify-center shrink-0">
              <XIcon className="mu-icon w-5 h-5 text-mu-danger" />
            </div>
            <span className="mu-label text-mu-danger/80">{t("inbox.failed-to-load")}</span>
          </div>
          <button
            onClick={handleDeleteMessage}
            className="p-1.5 hover:bg-mu-danger-soft rounded-mu-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
            title={t("common.delete")}
          >
            <TrashIcon className="mu-icon text-mu-danger/70 hover:text-mu-danger transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  const isUnread = notification.status === UserNotification_Status.UNREAD;
  const isPending = payload.state === UserNotification_SpaceInvitationPayload_InvitationState.PENDING;
  const isBusy = acceptInvitation.isPending || declineInvitation.isPending;
  const spaceUid = extractSpaceUidFromName(space.name);
  const spaceLabel = `${space.title} (${spaceUid})`;

  const handleAccept = async () => {
    try {
      await acceptInvitation.mutateAsync({ name: payload.spaceInvitation });
      toast.add({ title: t("setting.spaces.accept-success", { space: spaceLabel }), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Accept space invitation" });
    }
  };

  const handleDecline = async () => {
    try {
      await declineInvitation.mutateAsync({ name: payload.spaceInvitation });
      toast.add({ title: t("setting.spaces.decline-success"), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Decline space invitation" });
    }
  };

  const handleOpenSpace = () => {
    selectSpace(space);
  };

  return (
    <div
      className={cn(
        "w-full px-5 py-4 border-b border-mu-line/60 last:border-b-0 transition-all duration-200 group relative",
        isUnread ? "bg-mu-primary/[0.03] hover:bg-mu-primary/[0.05]" : "hover:bg-mu-hover",
      )}
    >
      {isUnread && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-mu-primary to-mu-primary/60" />}

      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <UserAvatar className="w-10 h-10" avatarUrl={sender?.avatarUrl} name={sender?.displayName || sender?.username} />
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-mu-canvas flex items-center justify-center shadow-mu-pop transition-all",
              isUnread ? "bg-mu-primary text-mu-on-primary" : "bg-mu-well/80 text-mu-ink-muted",
            )}
          >
            <UsersIcon className="mu-icon-xs w-2.5 h-2.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="mu-label text-mu-ink/95">{sender?.displayName || sender?.username}</span>
              <span className="mu-body text-mu-ink-muted/80">{t("inbox.space-invitation")}</span>
              <span className="mu-caption text-mu-ink-muted/60">
                {notification.createTime &&
                  t("common.date-at-time", {
                    date: timestampDate(notification.createTime).toLocaleDateString([], { month: "short", day: "numeric" }),
                    time: timestampDate(notification.createTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  })}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isUnread ? (
                <button
                  onClick={() => handleArchiveMessage()}
                  className="p-1.5 hover:bg-mu-primary/10 rounded-mu-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title={t("common.archive")}
                >
                  <CheckIcon className="mu-icon text-mu-ink-muted hover:text-mu-primary transition-colors" />
                </button>
              ) : (
                <button
                  onClick={handleDeleteMessage}
                  className="p-1.5 hover:bg-mu-danger-soft rounded-mu-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title={t("common.delete")}
                >
                  <TrashIcon className="mu-icon text-mu-ink-muted hover:text-mu-danger transition-colors" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-mu-lg border border-mu-line/60 bg-mu-well/20 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SpaceMark icon={space.icon} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate mu-label text-mu-ink/95">{space.title}</span>
                  <span className="mu-caption text-mu-ink-muted/70">{spaceUid}</span>
                  <SpaceRoleBadge role={payload.role} />
                </div>
                <p className="line-clamp-1 mu-caption text-mu-ink-muted/80">
                  {isPending ? space.description || t("setting.spaces.invited-to-join") : t("inbox.space-invitation-accepted")}
                </p>
              </div>
            </div>
            {isPending ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="neutral" size="sm" disabled={isBusy} onClick={() => void handleDecline()}>
                  {t("setting.spaces.decline")}
                </Button>
                <Button variant="primary" size="sm" disabled={isBusy} onClick={() => void handleAccept()}>
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
