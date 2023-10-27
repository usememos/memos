import { useEffect } from "react";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoCommentMessage from "@/components/Inbox/MemoCommentMessage";
import MobileHeader from "@/components/MobileHeader";
import useInboxStore from "@/store/v1/inbox";
import { Inbox_Type } from "@/types/proto/api/v2/inbox_service";
import { useTranslate } from "@/utils/i18n";

const Inboxes = () => {
  const t = useTranslate();
  const inboxStore = useInboxStore();
  const inboxes = inboxStore.inboxes.sort((a, b) => {
    return a.status - b.status;
  });

  useEffect(() => {
    inboxStore.fetchInboxes();
  }, []);

  return (
    <section className="@container w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
        <div className="relative w-full flex flex-row justify-between items-center">
          <p className="px-2 py-1 flex flex-row justify-start items-center select-none opacity-80">
            <Icon.Bell className="w-5 h-auto mr-1" /> {t("common.inbox")}
          </p>
        </div>
        <div className="w-full h-auto flex flex-col justify-start items-start px-2 pb-4 bg-white dark:bg-zinc-700">
          {inboxes.length === 0 && (
            <div className="w-full mt-4 mb-8 flex flex-col justify-center items-center italic">
              <Empty />
              <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
            </div>
          )}
          <div className="flex flex-col justify-start items-start w-full mt-4 gap-4">
            {inboxes.map((inbox) => {
              if (inbox.type === Inbox_Type.TYPE_MEMO_COMMENT) {
                return <MemoCommentMessage key={`${inbox.name}-${inbox.status}`} inbox={inbox} />;
              }
              return undefined;
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Inboxes;
