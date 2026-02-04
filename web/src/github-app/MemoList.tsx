import type { Memo } from "../lib/github";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MemoListProps {
  memos: Memo[];
  onEdit: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export function MemoList({ memos, onEdit, onDelete, onTogglePin }: MemoListProps) {
  if (memos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-zinc-400 dark:text-zinc-500 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400">No memos yet</p>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
          Start writing your first memo above
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {memos.map((memo) => (
        <MemoCard
          key={memo.id}
          memo={memo}
          onEdit={() => onEdit(memo)}
          onDelete={() => onDelete(memo.id)}
          onTogglePin={() => onTogglePin(memo.id, !memo.pinned)}
        />
      ))}
    </div>
  );
}

interface MemoCardProps {
  memo: Memo;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function MemoCard({ memo, onEdit, onDelete, onTogglePin }: MemoCardProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? "Just now" : `${minutes} minutes ago`;
      }
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <article className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <img
              src={memo.creator.avatarUrl}
              alt={memo.creator.name}
              className="w-5 h-5 rounded-full"
            />
            <span>{memo.creator.name}</span>
            <span>·</span>
            <time>{formatDate(memo.updatedAt)}</time>
            {memo.pinned && (
              <>
                <span>·</span>
                <span className="text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477V16h2a1 1 0 110 2H8a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                  </svg>
                  Pinned
                </span>
              </>
            )}
            {memo.visibility === "PRIVATE" && (
              <>
                <span>·</span>
                <span className="text-zinc-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Private
                </span>
              </>
            )}
          </div>

          {/* Actions dropdown */}
          <div className="relative group">
            <button className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-700 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={onEdit}
                className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-600 first:rounded-t-lg"
              >
                Edit
              </button>
              <button
                onClick={onTogglePin}
                className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-600"
              >
                {memo.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={onDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-600 last:rounded-b-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo.content}</ReactMarkdown>
        </div>

        {/* Tags */}
        {memo.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {memo.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
