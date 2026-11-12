import { timestampDate } from "@bufbuild/protobuf/wkt";
import { sortBy } from "lodash-es";
import { BellIcon } from "lucide-react";
import MemoCommentMessage from "@/components/Inbox/MemoCommentMessage";
import MemoMentionMessage from "@/components/Inbox/MemoMentionMessage";
import SpaceInvitationMessage from "@/components/Inbox/SpaceInvitationMessage";
import Placeholder from "@/components/Placeholder";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useNotifications } from "@/hooks/useUserQueries";
import { UserNotification, UserNotification_Status, UserNotification_Type } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

const Inboxes = () => {
  const t = useTranslate();
  const { inboxFilter: filter } = useAppSidebar();

  // Fetch notifications with React Query
  const { data: fetchedNotifications = [] } = useNotifications();

  const allNotifications = sortBy(fetchedNotifications, (notification: UserNotification) => {
    return -((notification.createTime ? timestampDate(notification.createTime) : undefined)?.getTime() || 0);
  });

  const notifications = allNotifications.filter((notification) => {
    if (filter === "unread") return notification.status === UserNotification_Status.UNREAD;
    if (filter === "archived") return notification.status === UserNotification_Status.ARCHIVED;
    return true;
  });

  const unreadCount = allNotifications.filter((n) => n.status === UserNotification_Status.UNREAD).length;
  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-mu-line flex flex-col justify-start items-start rounded-mu-xl bg-mu-canvas text-mu-ink overflow-hidden">
          {/* Header */}
          <div className="w-full px-4 py-4 border-b border-mu-line">
            <div className="flex flex-row justify-between items-center">
              <div className="flex flex-row items-center gap-2">
                <BellIcon className="mu-icon w-5 h-auto text-mu-ink-muted" />
                <h1 className="mu-heading">{t("common.inbox")}</h1>
                {unreadCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 mu-label-sm rounded-full bg-mu-primary text-mu-on-primary">{unreadCount}</span>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="w-full">
            {notifications.length === 0 ? (
              <Placeholder
                scene="inbox"
                message={filter === "unread" ? t("inbox.no-unread") : filter === "archived" ? t("inbox.no-archived") : t("message.no-data")}
              />
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification: UserNotification) => {
                  if (notification.type === UserNotification_Type.MEMO_COMMENT) {
                    return <MemoCommentMessage key={notification.name} notification={notification} />;
                  }
                  if (notification.type === UserNotification_Type.MEMO_MENTION) {
                    return <MemoMentionMessage key={notification.name} notification={notification} />;
                  }
                  if (notification.type === UserNotification_Type.SPACE_INVITATION) {
                    return <SpaceInvitationMessage key={notification.name} notification={notification} />;
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Inboxes;
