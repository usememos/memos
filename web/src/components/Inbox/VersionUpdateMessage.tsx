import { Tooltip } from "@mui/joy";
import clsx from "clsx";
import { ArrowUpIcon, InboxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { activityServiceClient } from "@/grpcweb";
import { activityNamePrefix, useInboxStore } from "@/store/v1";
import { Activity } from "@/types/proto/api/v1/activity_service";
import { Inbox, Inbox_Status } from "@/types/proto/api/v1/inbox_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  inbox: Inbox;
}

const VersionUpdateMessage = ({ inbox }: Props) => {
  const t = useTranslate();
  const inboxStore = useInboxStore();
  const [activity, setActivity] = useState<Activity | undefined>(undefined);

  useEffect(() => {
    if (!inbox.activityId) {
      return;
    }

    (async () => {
      const activity = await activityServiceClient.getActivity({
        name: `${activityNamePrefix}${inbox.activityId}`,
      });
      setActivity(activity);
    })();
  }, [inbox.activityId]);

  const handleNavigate = () => {
    if (!activity?.payload?.versionUpdate?.version) {
      return;
    }

    window.open(`https://github.com/usememos/memos/releases/tag/v${activity?.payload?.versionUpdate?.version}`);
    if (inbox.status === Inbox_Status.UNREAD) {
      handleArchiveMessage(true);
    }
  };

  const handleArchiveMessage = async (silence = false) => {
    await inboxStore.updateInbox(
      {
        name: inbox.name,
        status: Inbox_Status.ARCHIVED,
      },
      ["status"],
    );
    if (!silence) {
      toast.success(t("message.archived-successfully"));
    }
  };

  return (
    <div className="w-full flex flex-row justify-start items-start gap-3">
      <div
        className={clsx(
          "shrink-0 mt-2 p-2 rounded-full border",
          inbox.status === Inbox_Status.UNREAD
            ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-zinc-800"
            : "border-gray-500 text-gray-500 bg-gray-50 dark:bg-zinc-800",
        )}
      >
        <Tooltip title={"Update"} placement="bottom">
          <ArrowUpIcon className="w-4 sm:w-5 h-auto" />
        </Tooltip>
      </div>
      <div
        className={clsx(
          "border w-full p-2 px-3 rounded-lg flex flex-col justify-start items-start gap-1 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700",
          inbox.status !== Inbox_Status.UNREAD && "opacity-60",
        )}
      >
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-sm text-gray-500">{inbox.createTime?.toLocaleString()}</span>
          <div>
            {inbox.status === Inbox_Status.UNREAD && (
              <Tooltip title={t("common.archive")} placement="top">
                <InboxIcon className="w-4 h-auto cursor-pointer text-gray-400 hover:text-blue-600" onClick={() => handleArchiveMessage()} />
              </Tooltip>
            )}
          </div>
        </div>
        <p
          className="text-base leading-tight cursor-pointer text-gray-500 dark:text-gray-400 hover:underline hover:text-blue-600"
          onClick={handleNavigate}
        >
          {t("inbox.version-update", {
            version: activity?.payload?.versionUpdate?.version,
          })}
        </p>
      </div>
    </div>
  );
};

export default VersionUpdateMessage;
