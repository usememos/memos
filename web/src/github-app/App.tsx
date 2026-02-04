import { useEffect, useState } from "react";
import { useAuth, useMemos, useTags } from "../lib/hooks";
import type { Memo } from "../lib/github";
import { SignIn } from "./SignIn";
import { MemoEditor } from "./MemoEditor";
import { MemoList } from "./MemoList";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export default function App() {
  const { isAuthenticated, user, loading: authLoading, signOut } = useAuth();
  const { memos, loading: memosLoading, fetchMemos, createMemo, updateMemo, deleteMemo, togglePin } = useMemos();
  const { tags, fetchTags } = useTags();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchMemos();
      fetchTags();
    }
  }, [isAuthenticated, fetchMemos, fetchTags]);

  useEffect(() => {
    if (isAuthenticated && selectedTag) {
      fetchMemos({ labels: `tag:${selectedTag}` });
    } else if (isAuthenticated) {
      fetchMemos();
    }
  }, [selectedTag, isAuthenticated, fetchMemos]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  const handleCreateMemo = async (content: string, options?: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean }) => {
    await createMemo(content, options);
    fetchTags();
  };

  const handleUpdateMemo = async (id: string, content: string, options?: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean }) => {
    await updateMemo(id, content, options);
    setEditingMemo(null);
    fetchTags();
  };

  const handleDeleteMemo = async (id: string) => {
    if (confirm("Are you sure you want to delete this memo?")) {
      await deleteMemo(id);
    }
  };

  const filteredMemos = searchQuery
    ? memos.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : memos;

  // Sort: pinned first, then by date
  const sortedMemos = [...filteredMemos].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Header
        user={user}
        onSignOut={signOut}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex">
        <Sidebar
          tags={tags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          memoCount={memos.length}
        />

        <main className="flex-1 max-w-3xl mx-auto px-4 py-6">
          <MemoEditor
            onSubmit={handleCreateMemo}
            editingMemo={editingMemo}
            onUpdate={handleUpdateMemo}
            onCancelEdit={() => setEditingMemo(null)}
          />

          {memosLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <MemoList
              memos={sortedMemos}
              onEdit={setEditingMemo}
              onDelete={handleDeleteMemo}
              onTogglePin={togglePin}
            />
          )}
        </main>
      </div>
    </div>
  );
}
