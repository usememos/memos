import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema, timestampDate } from "@bufbuild/protobuf/wkt";
import { CheckIcon, MessageCircleIcon, TrashIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "@/components/UserAvatar";
import { userServiceClient } from "@/connect";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { UserNotification, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  notification: UserNotification;
}

function MemoCommentMessage({ notification }: Props) {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const commentPayload = notification.payload?.case === "memoComment" ? notification.payload.value : undefined;
  const sender = notification.senderUser;

  const handleArchiveMessage = async (silence = false) => {
    await userServiceClient.updateUserNotification({
      notification: {
        name: notification.name,
        status: UserNotification_Status.ARCHIVED,
      },
      updateMask: create(FieldMaskSchema, { paths: ["status"] }),
    });
    if (!silence) {
      toast.success(t("message.archived-successfully"));
    }
  };

  const handleDeleteMessage = async () => {
    await userServiceClient.deleteUserNotification({
      name: notification.name,
    });
    toast.success(t("message.deleted-successfully"));
  };

  if (!commentPayload) {
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

  const handleNavigateToMemo = async () => {
    navigateTo(`/${commentPayload.relatedMemo}`);
    if (isUnread) {
      await handleArchiveMessage(true);
    }
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
            <MessageCircleIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-semibold text-sm text-foreground/95">{sender?.displayName || sender?.username}</span>
              <span className="text-sm text-muted-foreground/80">commented on your memo</span>
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

          <div className="pl-3 border-l-2 border-muted-foreground/20 mb-3">
            <p className="text-sm text-foreground/60 line-clamp-1 leading-relaxed">
              <span className="text-xs text-muted-foreground/50 font-medium mr-2 uppercase tracking-wide">Original:</span>
              {commentPayload.relatedMemoSnippet || <span className="italic text-muted-foreground/40">Empty memo</span>}
            </p>
          </div>

          <div
            onClick={handleNavigateToMemo}
            className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-primary/[0.06] to-primary/[0.03] hover:from-primary/[0.1] hover:to-primary/[0.06] cursor-pointer border border-primary/30 hover:border-primary/50 transition-all duration-200 group/comment shadow-sm hover:shadow"
          >
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <MessageCircleIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary/60 font-semibold mb-1 uppercase tracking-wider">Comment</p>
                <p className="text-sm text-foreground/90 line-clamp-2">
                  {commentPayload.memoSnippet || <span className="italic text-muted-foreground/50">Empty comment</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemoCommentMessage;
