import { CheckIcon, MessageCircleIcon, TrashIcon, XIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import toast from "react-hot-toast";
import UserAvatar from "@/components/UserAvatar";
import { activityServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { memoStore, userStore } from "@/store";
import { activityNamePrefix } from "@/store/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { User, UserNotification, UserNotification_Status } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  notification: UserNotification;
}

const MemoCommentMessage = observer(({ notification }: Props) => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const [relatedMemo, setRelatedMemo] = useState<Memo | undefined>(undefined);
  const [commentMemo, setCommentMemo] = useState<Memo | undefined>(undefined);
  const [sender, setSender] = useState<User | undefined>(undefined);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useAsyncEffect(async () => {
    if (!notification.activityId) {
      return;
    }

    try {
      const activity = await activityServiceClient.getActivity({
        name: `${activityNamePrefix}${notification.activityId}`,
      });

      if (activity.payload?.memoComment) {
        const memoCommentPayload = activity.payload.memoComment;
        const memo = await memoStore.getOrFetchMemoByName(memoCommentPayload.relatedMemo, {
          skipStore: true,
        });
        setRelatedMemo(memo);

        // Fetch the comment memo
        const comment = await memoStore.getOrFetchMemoByName(memoCommentPayload.memo, {
          skipStore: true,
        });
        setCommentMemo(comment);

        const sender = await userStore.getOrFetchUserByName(notification.sender);
        setSender(sender);
        setInitialized(true);
      }
    } catch (error) {
      console.error("Failed to fetch activity:", error);
      setHasError(true);
      return;
    }
  }, [notification.activityId]);

  const handleNavigateToMemo = async () => {
    if (!relatedMemo) {
      return;
    }

    navigateTo(`/${relatedMemo.name}`);
    if (notification.status === UserNotification_Status.UNREAD) {
      handleArchiveMessage(true);
    }
  };

  const handleArchiveMessage = async (silence = false) => {
    await userStore.updateNotification(
      {
        name: notification.name,
        status: UserNotification_Status.ARCHIVED,
      },
      ["status"],
    );
    if (!silence) {
      toast.success(t("message.archived-successfully"));
    }
  };

  const handleDeleteMessage = async () => {
    await userStore.deleteNotification(notification.name);
    toast.success(t("message.deleted-successfully"));
  };

  if (!initialized && !hasError) {
    return (
      <div className="w-full px-4 py-3.5 border-b border-border last:border-b-0 bg-muted/20 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-muted/60 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3.5 bg-muted/60 rounded w-2/5" />
            <div className="h-16 bg-muted/40 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full px-4 py-3.5 border-b border-border last:border-b-0 bg-destructive/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <XIcon className="w-4 h-4 text-destructive" />
            </div>
            <span className="text-sm text-destructive/90">{t("inbox.failed-to-load")}</span>
          </div>
          <button
            onClick={handleDeleteMessage}
            className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
            title={t("common.delete")}
          >
            <TrashIcon className="w-3.5 h-3.5 text-destructive/70 hover:text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  const isUnread = notification.status === UserNotification_Status.UNREAD;

  return (
    <div
      className={cn(
        "w-full px-4 py-3.5 border-b border-border last:border-b-0 transition-colors group relative",
        isUnread ? "bg-primary/[0.02] hover:bg-primary/[0.04]" : "hover:bg-muted/40",
      )}
    >
      {/* Unread indicator bar */}
      {isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}

      <div className="flex items-start gap-3">
        {/* Avatar & Icon */}
        <div className="relative shrink-0 mt-0.5">
          <UserAvatar className="w-9 h-9" avatarUrl={sender?.avatarUrl} />
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full border-[2px] border-background flex items-center justify-center shadow-sm",
              isUnread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <MessageCircleIcon className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{sender?.displayName || sender?.username}</span>
              <span className="text-sm text-muted-foreground">commented on your memo</span>
              <span className="text-xs text-muted-foreground/80">
                · {notification.createTime?.toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
                {notification.createTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {isUnread ? (
                <button
                  onClick={() => handleArchiveMessage()}
                  className="p-1.5 hover:bg-background/80 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title={t("common.archive")}
                >
                  <CheckIcon className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                </button>
              ) : (
                <button
                  onClick={handleDeleteMessage}
                  className="p-1.5 hover:bg-background/80 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title={t("common.delete")}
                >
                  <TrashIcon className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          </div>

          {/* Comment Preview */}
          {commentMemo && (
            <div
              onClick={handleNavigateToMemo}
              className="mt-2 p-3 rounded-md bg-muted/40 hover:bg-muted/60 cursor-pointer border border-border/50 hover:border-border transition-all group/comment"
            >
              <div className="flex items-start gap-2">
                <MessageCircleIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                <p className="text-[13px] text-foreground/90 line-clamp-2 leading-relaxed group-hover/comment:text-foreground transition-colors">
                  {commentMemo.content || <span className="italic text-muted-foreground">Empty comment</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MemoCommentMessage;
