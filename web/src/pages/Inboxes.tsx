import { BellIcon } from "lucide-react";
import { useEffect } from "react";
import Empty from "@/components/Empty";
import MemoCommentMessage from "@/components/Inbox/MemoCommentMessage";
import VersionUpdateMessage from "@/components/Inbox/VersionUpdateMessage";
import MobileHeader from "@/components/MobileHeader";
import { useInboxStore } from "@/store/v1";
import { Inbox_Status, Inbox_Type } from "@/types/proto/api/v1/inbox_service";
import { useTranslate } from "@/utils/i18n";

const Inboxes = () => {
  const t = useTranslate();
  const inboxStore = useInboxStore();
  const inboxes = inboxStore.inboxes.sort((a, b) => {
    if (a.status === b.status) {
      return 0;
    }
    return a.status === Inbox_Status.UNREAD ? -1 : 1;
  });

  useEffect(() => {
    inboxStore.fetchInboxes();
  }, []);

  return (
    <section id="inbox" className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-black dark:text-gray-300">
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
                <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
              </div>
            )}
            <div className="flex flex-col justify-start items-start w-full mt-4 gap-4">
              {inboxes.map((inbox) => {
                if (inbox.type === Inbox_Type.MEMO_COMMENT) {
                  return <MemoCommentMessage key={`${inbox.name}-${inbox.status}`} inbox={inbox} />;
                } else if (inbox.type === Inbox_Type.VERSION_UPDATE) {
                  return <VersionUpdateMessage key={`${inbox.name}-${inbox.status}`} inbox={inbox} />;
                }
                return undefined;
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Inboxes;
