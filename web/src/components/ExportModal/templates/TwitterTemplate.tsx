import { useEffect, useState } from "react";
import MemoContent from "@/components/MemoContent";
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

  // Format date like Twitter: "5:01 AM · Mar 3, 2025"
  const formatTwitterDate = (date: Date | undefined) => {
    if (!date) return "";

    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();

    return `${time} · ${month} ${day}, ${year}`;
  };

  // Mock data for engagement stats
  const mockStats = {
    replies: Math.floor(Math.random() * 10),
    retweets: Math.floor(Math.random() * 50),
    likes: Math.floor(Math.random() * 300),
    bookmarks: Math.floor(Math.random() * 150),
    views: Math.floor(Math.random() * 15000),
    isLiked: Math.random() > 0.5, // Random liked state
    isBookmarked: Math.random() > 0.7, // Random bookmarked state
  };

  return (
    <div className="bg-white dark:bg-black rounded-xl p-4 shadow-sm border border-gray-200 dark:border-zinc-800 max-w-[600px] font-sans">
      {/* Header */}
      <div className="flex items-center mb-3">
        {creator && (
          <img
            src={creator.avatarUrl || "https://www.gravatar.com/avatar/0?d=mp"}
            alt={`${creator.nickname || creator.username || memo.creator}'s avatar`}
            className="mr-2 w-10 h-10 rounded-full object-cover"
          />
        )}
        <div className="flex-1 text-sm">
          <div className="flex items-center">
            <span className="font-bold text-black dark:text-white mr-1">{creator?.nickname || creator?.username || memo.creator}</span>
            {/* Verified badge */}
            <svg viewBox="0 0 24 24" aria-label="Verified account" className="w-5 h-5 text-blue-500 fill-current">
              <g>
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path>
              </g>
            </svg>
          </div>
          <div className="text-gray-500">@{creator?.username || memo.creator}</div>
        </div>
        <div className="text-gray-500">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <g>
              <path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path>
            </g>
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3 text-black dark:text-white text-lg">
        <MemoContent memoName={memo.name} nodes={memo.nodes} readonly={true} compact={false} />
      </div>

      {/* Time */}
      <div className="text-gray-500 text-sm mb-3">
        {formatTwitterDate(memo.displayTime)} ·{" "}
        <span className="font-bold text-black dark:text-white">{mockStats.views.toLocaleString()}</span> Views
      </div>

      {/* Engagement stats */}
      <div className="border-t border-b border-gray-200 dark:border-zinc-800 py-3 flex justify-between">
        <div className="flex items-center text-gray-500">
          <svg viewBox="0 0 24 24" className="w-5 h-5 mr-1 fill-current">
            <g>
              <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path>
            </g>
          </svg>
          <span>{mockStats.replies}</span>
        </div>
        <div className="flex items-center text-gray-500">
          <svg viewBox="0 0 24 24" className="w-5 h-5 mr-1 fill-current">
            <g>
              <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path>
            </g>
          </svg>
          <span>{mockStats.retweets}</span>
        </div>
        <div className={`flex items-center ${mockStats.isLiked ? "text-[rgb(249,24,128)]" : "text-gray-500"}`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 mr-1 fill-current">
            <g>
              {mockStats.isLiked ? (
                <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path>
              ) : (
                <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path>
              )}
            </g>
          </svg>
          <span>{mockStats.likes}</span>
        </div>
        <div className={`flex items-center ${mockStats.isBookmarked ? "text-[rgb(29,155,240)]" : "text-gray-500"}`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 mr-1 fill-current">
            <g>
              {mockStats.isBookmarked ? (
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path>
              ) : (
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"></path>
              )}
            </g>
          </svg>
          <span>{mockStats.bookmarks}</span>
        </div>
        <div className="flex items-center text-gray-500">
          <svg viewBox="0 0 24 24" className="w-5 h-5 mr-1 fill-current">
            <g>
              <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default TwitterTemplate;
