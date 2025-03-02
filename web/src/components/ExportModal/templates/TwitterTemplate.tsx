import { useEffect, useState } from "react";
import MemoContent from "@/components/MemoContent";
import UserAvatar from "@/components/UserAvatar";
import { useUserStore } from "@/store/v1";
import { Memo } from "@/types/proto/api/v1/memo_service";

interface TwitterTemplateProps {
  memo: Memo;
}

const TwitterTemplate = ({ memo }: TwitterTemplateProps) => {
  const [creator, setCreator] = useState<any>(null);
  const userStore = useUserStore();

  useEffect(() => {
    // Get creator info
    const fetchCreator = async () => {
      const user = await userStore.getOrFetchUserByName(memo.creator);
      setCreator(user);
    };
    fetchCreator();
  }, [memo, userStore]);

  // Format date like Twitter: "10:30 AM · May 26, 2023"
  const formatTwitterDate = (date: Date | undefined) => {
    if (!date) return "";

    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();

    return `${time} · ${month} ${day}, ${year}`;
  };

  return (
    <div className="bg-white dark:bg-black rounded-xl p-4 shadow-sm border border-gray-200 dark:border-zinc-800 max-w-[500px] font-sans">
      {/* Header */}
      <div className="flex items-start mb-3">
        {creator && <UserAvatar className="mr-3 w-12 h-12" avatarUrl={creator.avatarUrl} />}
        <div>
          <div className="font-bold text-black dark:text-white">{creator?.nickname || creator?.username || memo.creator}</div>
          <div className="text-gray-500">@{creator?.username || memo.creator}</div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <MemoContent memoName={memo.name} nodes={memo.nodes} readonly={true} compact={false} />
      </div>

      {/* Time */}
      <div className="text-gray-500 text-sm border-t border-gray-200 dark:border-zinc-800 pt-3 mt-3">
        {formatTwitterDate(memo.displayTime)}
      </div>
    </div>
  );
};

export default TwitterTemplate;
