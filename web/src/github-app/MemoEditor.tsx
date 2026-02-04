import { useEffect, useRef, useState } from "react";
import type { Memo } from "../lib/github";

interface MemoEditorProps {
  onSubmit: (content: string, options?: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean }) => Promise<void>;
  editingMemo?: Memo | null;
  onUpdate?: (id: string, content: string, options?: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean }) => Promise<void>;
  onCancelEdit?: () => void;
}

export function MemoEditor({ onSubmit, editingMemo, onUpdate, onCancelEdit }: MemoEditorProps) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [pinned, setPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingMemo) {
      setContent(editingMemo.content);
      setVisibility(editingMemo.visibility);
      setPinned(editingMemo.pinned);
      setIsExpanded(true);
      textareaRef.current?.focus();
    }
  }, [editingMemo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingMemo && onUpdate) {
        await onUpdate(editingMemo.id, content, { visibility, pinned });
      } else {
        await onSubmit(content, { visibility, pinned });
      }
      setContent("");
      setVisibility("PRIVATE");
      setPinned(false);
      setIsExpanded(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
    if (e.key === "Escape") {
      if (editingMemo && onCancelEdit) {
        onCancelEdit();
        setContent("");
        setIsExpanded(false);
      }
    }
  };

  const handleCancel = () => {
    if (editingMemo && onCancelEdit) {
      onCancelEdit();
    }
    setContent("");
    setVisibility("PRIVATE");
    setPinned(false);
    setIsExpanded(false);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-6">
      <form onSubmit={handleSubmit}>
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Use #tags to organize..."
            className="w-full min-h-[100px] resize-none bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            rows={isExpanded ? 5 : 2}
          />
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-700 pt-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                  className="bg-zinc-100 dark:bg-zinc-700 border-0 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                />
                Pin
              </label>
            </div>

            <div className="flex items-center gap-2">
              {(content || editingMemo) && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Saving..." : editingMemo ? "Update" : "Save"}
              </button>
            </div>
          </div>
        )}
      </form>

      {isExpanded && (
        <div className="px-4 pb-3 text-xs text-zinc-400">
          Press <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded">Cmd/Ctrl + Enter</kbd> to save
        </div>
      )}
    </div>
  );
}
