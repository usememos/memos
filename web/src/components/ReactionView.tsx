import { Tooltip } from "@mui/joy";
import clsx from "clsx";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { User } from "@/types/proto/api/v1/user_service";

interface Props {
  memo: Memo;
  reactionType: string;
  users: User[];
}

const stringifyUsers = (users: User[], reactionType: string): string => {
  if (users.length === 0) {
    return "";
  }
  if (users.length < 5) {
    return users.map((user) => user.nickname || user.username).join(", ") + " reacted with " + reactionType.toLowerCase();
  }
  return (
    `${users
      .slice(0, 4)
      .map((user) => user.nickname || user.username)
      .join(", ")} and ${users.length - 4} more reacted with ` + reactionType.toLowerCase()
  );
};

const ReactionView = (props: Props) => {
  const { memo, reactionType, users } = props;
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const hasReaction = users.some((user) => currentUser && user.username === currentUser.username);

  const handleReactionClick = async () => {
    if (!currentUser) {
      return;
    }

    const index = users.findIndex((user) => user.username === currentUser.username);
    try {
      if (index === -1) {
        await memoServiceClient.upsertMemoReaction({
          name: memo.name,
          reaction: {
            contentId: memo.name,
            reactionType,
          },
        });
      } else {
        const reactions = memo.reactions.filter(
          (reaction) => reaction.reactionType === reactionType && reaction.creator === currentUser.name,
        );
        for (const reaction of reactions) {
          await memoServiceClient.deleteMemoReaction({ reactionId: reaction.id });
        }
      }
    } catch (error) {
      // Skip error.
    }
    await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
  };

  return (
    <Tooltip title={stringifyUsers(users, reactionType)} placement="top">
      <div
        className={clsx(
          "h-7 border px-2 py-0.5 rounded-full flex flex-row justify-center items-center gap-1 dark:border-zinc-700",
          "text-sm text-gray-600 dark:text-gray-400",
          currentUser && "cursor-pointer",
          hasReaction && "bg-blue-100 border-blue-200 dark:bg-zinc-900",
        )}
        onClick={handleReactionClick}
      >
        <span>{reactionType}</span>
        <span className="opacity-60">{users.length}</span>
      </div>
    </Tooltip>
  );
};

export default ReactionView;
