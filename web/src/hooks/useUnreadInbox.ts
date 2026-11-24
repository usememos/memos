import { useNotifications } from "@/hooks/useUserQueries";
import { UserNotification_Status } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

/** Unread notifications, counted once for the sidebar's account row and the Inbox row of its menu. */
export const useUnreadInbox = () => {
  const t = useTranslate();
  const { data: notifications = [] } = useNotifications();
  const count = notifications.filter((notification) => notification.status === UserNotification_Status.UNREAD).length;
  return {
    count,
    text: count > 99 ? "99+" : `${count}`,
    /** The Inbox link's accessible name, which carries the count. */
    label: count > 0 ? `${t("common.inbox")}, ${count} ${t("inbox.unread")}` : t("common.inbox"),
  };
};
