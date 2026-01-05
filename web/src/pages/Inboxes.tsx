import { timestampDate } from "@bufbuild/protobuf/wkt";
import { sortBy } from "lodash-es";
import { ArchiveIcon, BellIcon, InboxIcon } from "lucide-react";
import { useState } from "react";
import Empty from "@/components/Empty";
import MemoCommentMessage from "@/components/Inbox/MemoCommentMessage";
import MobileHeader from "@/components/MobileHeader";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { UserNotification, UserNotification_Status, UserNotification_Type } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

const Inboxes = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");

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
  const archivedCount = allNotifications.filter((n) => n.status === UserNotification_Status.ARCHIVED).length;

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-col justify-start items-start rounded-xl bg-background text-foreground overflow-hidden">
          {/* Header */}
          <div className="w-full px-4 py-4 border-b border-border">
            <div className="flex flex-row justify-between items-center">
              <div className="flex flex-row items-center gap-2">
                <BellIcon className="w-5 h-auto text-muted-foreground" />
                <h1 className="text-xl font-semibold">{t("common.inbox")}</h1>
                {unreadCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="w-full px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex flex-row gap-1">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  filter === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                {t("common.all")} ({allNotifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                  filter === "unread"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <InboxIcon className="w-3.5 h-auto" />
                {t("inbox.unread")} ({unreadCount})
              </button>
              <button
                onClick={() => setFilter("archived")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                  filter === "archived"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <ArchiveIcon className="w-3.5 h-auto" />
                {t("common.archived")} ({archivedCount})
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="w-full">
            {notifications.length === 0 ? (
              <div className="w-full py-16 flex flex-col justify-center items-center">
                <Empty />
                <p className="mt-4 text-sm text-muted-foreground">
                  {filter === "unread" ? t("inbox.no-unread") : filter === "archived" ? t("inbox.no-archived") : t("message.no-data")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification: UserNotification) => {
                  if (notification.type === UserNotification_Type.MEMO_COMMENT) {
                    return <MemoCommentMessage key={notification.name} notification={notification} />;
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
