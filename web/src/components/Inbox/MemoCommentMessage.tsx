import { timestampDate } from "@bufbuild/protobuf/wkt";
import { CheckIcon, MessageCircleIcon, TrashIcon, XIcon } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useArchiveNotification, useDeleteNotification } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { UserNotification, UserNotification_Status } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  notification: UserNotification;
}

function MemoCommentMessage({ notification }: Props) {
  const t = useTranslate();
  const archiveNotification = useArchiveNotification();
  const deleteNotification = useDeleteNotification();
  const navigateTo = useNavigateTo();
  const commentPayload = notification.payload?.case === "memoComment" ? notification.payload.value : undefined;
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

  if (!commentPayload) {
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

  const handleNavigateToMemo = async () => {
    navigateTo(`/${commentPayload.relatedMemo}`);
    if (isUnread) {
      await handleArchiveMessage(true);
    }
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
            <MessageCircleIcon className="mu-icon-xs w-2.5 h-2.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="mu-label text-mu-ink/95">{sender?.displayName || sender?.username}</span>
              <span className="mu-body text-mu-ink-muted/80">{t("inbox.commented-on-memo")}</span>
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

          <div className="pl-3 border-l-2 border-mu-ink-muted/20 mb-3">
            <p className="mu-body text-mu-ink/60 line-clamp-1">
              <span className="mu-label-sm text-mu-ink-muted/50 mr-2 uppercase tracking-wide">{t("inbox.original")}</span>
              {commentPayload.relatedMemoSnippet || <span className="italic text-mu-ink-muted/40">{t("inbox.empty-memo")}</span>}
            </p>
          </div>

          <button
            type="button"
            onClick={handleNavigateToMemo}
            className="w-full p-2 text-left sm:p-3 rounded-mu-lg bg-gradient-to-br from-mu-primary/[0.06] to-mu-primary/[0.03] hover:from-mu-primary/[0.1] hover:to-mu-primary/[0.06] cursor-pointer border border-mu-primary/30 hover:border-mu-primary/50 transition-all duration-200 group/comment shadow-mu-key hover:shadow"
          >
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <MessageCircleIcon className="mu-icon text-mu-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="mu-label-sm text-mu-primary/60 mb-1 uppercase tracking-wider">{t("inbox.comment-heading")}</p>
                <p className="mu-body text-mu-ink/90 line-clamp-2">
                  {commentPayload.memoSnippet || <span className="italic text-mu-ink-muted/50">{t("inbox.empty-comment")}</span>}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemoCommentMessage;
