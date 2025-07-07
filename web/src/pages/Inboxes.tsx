import { sortBy } from "lodash-es";
import { BellIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import Empty from "@/components/Empty";
import MemoCommentMessage from "@/components/Inbox/MemoCommentMessage";
import MobileHeader from "@/components/MobileHeader";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { userStore } from "@/store";
import { Inbox, Inbox_Status, Inbox_Type } from "@/types/proto/api/v1/inbox_service";
import { useTranslate } from "@/utils/i18n";

const Inboxes = observer(() => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();

  const inboxes = sortBy(userStore.state.inboxes, (inbox: Inbox) => {
    if (inbox.status === Inbox_Status.UNREAD) return 0;
    if (inbox.status === Inbox_Status.ARCHIVED) return 1;
    return 2;
  });

  const fetchInboxes = async () => {
    try {
      await userStore.fetchInboxes();
    } catch (error) {
      console.error("Failed to fetch inboxes:", error);
    }
  };

  useEffect(() => {
    fetchInboxes();
  }, []);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-background text-foreground">
          <div className="relative w-full flex flex-row justify-between items-center">
            <p className="py-1 flex flex-row justify-start items-center select-none opacity-80">
              <BellIcon className="w-6 h-auto mr-1 opacity-80" />
              <span className="text-lg">{t("common.inbox")}</span>
            </p>
          </div>
          <div className="w-full h-auto flex flex-col justify-start items-start px-2 pb-4">
            {inboxes.length === 0 && (
              <div className="w-full mt-4 mb-8 flex flex-col justify-center items-center italic">
                <Empty />
                <p className="mt-4 text-muted-foreground">{t("message.no-data")}</p>
              </div>
            )}
            <div className="flex flex-col justify-start items-start w-full mt-4 gap-4">
              {inboxes.map((inbox: Inbox) => {
                if (inbox.type === Inbox_Type.MEMO_COMMENT) {
                  return <MemoCommentMessage key={`${inbox.name}-${inbox.status}`} inbox={inbox} />;
                }
                return undefined;
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default Inboxes;
