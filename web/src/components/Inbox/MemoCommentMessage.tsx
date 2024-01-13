import { Tooltip } from "@mui/joy";
import classNames from "classnames";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { activityServiceClient } from "@/grpcweb";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useInboxStore, extractUsernameFromName } from "@/store/v1";
import { Activity } from "@/types/proto/api/v2/activity_service";
import { Inbox, Inbox_Status } from "@/types/proto/api/v2/inbox_service";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";

interface Props {
  inbox: Inbox;
}

const MemoCommentMessage = ({ inbox }: Props) => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const inboxStore = useInboxStore();
  const [activity, setActivity] = useState<Activity | undefined>(undefined);

  useEffect(() => {
    if (!inbox.activityId) {
      return;
    }

    activityServiceClient
      .getActivity({
        id: inbox.activityId,
      })
      .then(({ activity }) => {
        setActivity(activity);
      });
  }, [inbox.activityId]);

  const handleNavigateToMemo = () => {
    if (!activity?.payload?.memoComment?.relatedMemoId) {
      return;
    }
    navigateTo(`/m/${activity?.payload?.memoComment?.relatedMemoId}`);
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
      ["status"]
    );
    if (!silence) {
      toast.success("Archived");
    }
  };

  return (
    <div className="w-full flex flex-row justify-start items-start gap-3">
      <div
        className={classNames(
          "shrink-0 mt-2 p-2 rounded-full border",
          inbox.status === Inbox_Status.UNREAD
            ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-zinc-800"
            : "border-gray-500 text-gray-500 bg-gray-50 dark:bg-zinc-800"
        )}
      >
        <Tooltip title={"Comment"} placement="bottom">
          <Icon.MessageCircle className="w-4 sm:w-5 h-auto" />
        </Tooltip>
      </div>
      <div
        className={classNames(
          "border w-full p-3 px-4 rounded-lg flex flex-col justify-start items-start gap-2 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700",
          inbox.status !== Inbox_Status.UNREAD && "opacity-60"
        )}
      >
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-xs text-gray-500">{inbox.createTime?.toLocaleString()}</span>
          <div>
            {inbox.status === Inbox_Status.UNREAD && (
              <Tooltip title={t("common.archive")} placement="top">
                <Icon.Inbox
                  className="w-4 h-auto cursor-pointer text-gray-400 hover:text-blue-600"
                  onClick={() => handleArchiveMessage()}
                />
              </Tooltip>
            )}
          </div>
        </div>
        <p
          className="text-base leading-tight cursor-pointer text-gray-500 dark:text-gray-400 hover:underline hover:text-blue-600"
          onClick={handleNavigateToMemo}
        >
          {t("inbox.memo-comment", {
            user: extractUsernameFromName(inbox.sender),
            memo: `memo#${activity?.payload?.memoComment?.relatedMemoId}`,
          })}
        </p>
      </div>
    </div>
  );
};

export default MemoCommentMessage;
