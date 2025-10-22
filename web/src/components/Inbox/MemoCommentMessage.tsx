import { InboxIcon, LoaderIcon, MessageCircleIcon, TrashIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import toast from "react-hot-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { activityServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { memoStore, userStore } from "@/store";
import { activityNamePrefix } from "@/store/common";
import { Inbox, Inbox_Status } from "@/types/proto/api/v1/inbox_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  inbox: Inbox;
}

const MemoCommentMessage = observer(({ inbox }: Props) => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const [relatedMemo, setRelatedMemo] = useState<Memo | undefined>(undefined);
  const [sender, setSender] = useState<User | undefined>(undefined);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useAsyncEffect(async () => {
    if (!inbox.activityId) {
      return;
    }

    try {
      const activity = await activityServiceClient.getActivity({
        name: `${activityNamePrefix}${inbox.activityId}`,
      });

      if (activity.payload?.memoComment) {
        const memoCommentPayload = activity.payload.memoComment;
        const memo = await memoStore.getOrFetchMemoByName(memoCommentPayload.relatedMemo, {
          skipStore: true,
        });
        setRelatedMemo(memo);
        const sender = await userStore.getOrFetchUserByName(inbox.sender);
        setSender(sender);
        setInitialized(true);
      }
    } catch (error) {
      console.error("Failed to fetch activity:", error);
      setHasError(true);
      return;
    }
  }, [inbox.activityId]);

  const handleNavigateToMemo = async () => {
    if (!relatedMemo) {
      return;
    }

    navigateTo(`/${relatedMemo.name}`);
    if (inbox.status === Inbox_Status.UNREAD) {
      handleArchiveMessage(true);
    }
  };

  const handleArchiveMessage = async (silence = false) => {
    await userStore.updateInbox(
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

  const handleDeleteMessage = async () => {
    await userStore.deleteInbox(inbox.name);
    toast.success(t("message.deleted-successfully"));
  };

  const deleteButton = () => (
    <>
      <div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <TrashIcon
                className="w-4 h-auto cursor-pointer text-muted-foreground hover:text-primary"
                onClick={() => handleDeleteMessage()}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("common.delete")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  const archiveButton = () => (
    <>
      <div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <InboxIcon
                className="w-4 h-auto cursor-pointer text-muted-foreground hover:text-primary"
                onClick={() => handleArchiveMessage()}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("common.archive")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  return (
    <div className="w-full flex flex-row justify-start items-start gap-3">
      <div
        className={cn(
          "shrink-0 mt-2 p-2 rounded-full border",
          inbox.status === Inbox_Status.UNREAD
            ? "border-primary text-primary bg-primary/10"
            : "border-muted-foreground text-muted-foreground bg-muted",
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <MessageCircleIcon className="w-4 sm:w-5 h-auto" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Comment</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div
        className={cn(
          "border w-full p-2 px-3 rounded-lg flex flex-col justify-start items-start gap-1 border-border hover:bg-background",
          inbox.status !== Inbox_Status.UNREAD && "opacity-60",
        )}
      >
        {initialized ? (
          <>
            <div className="w-full flex flex-row justify-between items-center">
              <span className="text-sm text-muted-foreground">{inbox.createTime?.toLocaleString()}</span>
              {inbox.status === Inbox_Status.UNREAD ? archiveButton() : deleteButton()}
            </div>
            <p
              className="text-base leading-tight cursor-pointer text-muted-foreground hover:underline hover:text-primary"
              onClick={handleNavigateToMemo}
            >
              {t("inbox.memo-comment", {
                user: sender?.displayName || sender?.username,
                memo: relatedMemo?.name,
                interpolation: { escapeValue: false },
              })}
            </p>
          </>
        ) : hasError ? (
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("inbox.failed-to-load")}</span>
            {deleteButton()}
          </div>
        ) : (
          <div className="w-full flex flex-row justify-center items-center my-2">
            <LoaderIcon className="animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
});

export default MemoCommentMessage;
