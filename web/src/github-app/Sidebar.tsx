interface SidebarProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  memoCount: number;
}

export function Sidebar({ tags, selectedTag, onSelectTag, memoCount }: SidebarProps) {
  return (
    <aside className="hidden md:block w-64 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 min-h-[calc(100vh-57px)]">
      <div className="p-4">
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTag(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
              selectedTag === null
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              All Memos
            </span>
            <span className="text-xs bg-zinc-200 dark:bg-zinc-600 px-2 py-0.5 rounded-full">
              {memoCount}
            </span>
          </button>
        </nav>

        {tags.length > 0 && (
          <div className="mt-6">
            <h3 className="px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Tags
            </h3>
            <nav className="space-y-1">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onSelectTag(tag)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedTag === tag
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span className="text-blue-500">#</span>
                  {tag}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    </aside>
  );
}
