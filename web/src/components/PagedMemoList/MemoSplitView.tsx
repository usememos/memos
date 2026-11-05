import { timestampDate } from "@bufbuild/protobuf/wkt";
import { LoaderCircleIcon } from "lucide-react";
import { type KeyboardEvent, type ReactElement, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import RelativeTime from "@/components/RelativeTime";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { useAuth } from "@/contexts/AuthContext";
import { useView } from "@/contexts/ViewContext";
import { isMemoBlurred } from "@/lib/tag";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getMemoListPreview } from "./memoListPreview";

// Fetch the next page once the list pane is scrolled within this distance of its end.
const LIST_FETCH_THRESHOLD_PX = 300;

interface Props {
  memos: Memo[];
  getKey: (memo: Memo) => string;
  renderMemo: (memo: Memo) => ReactElement;
  /** Composer, filters and list states, shown above the selected memo. */
  leading?: ReactNode;
  /** Pagination errors, shown at the end of the list pane. */
  listFooter?: ReactNode;
  /** A freshly created memo; it becomes the selection so its author sees it open. */
  priorityKey?: string;
  canPaginate: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onFetchNext: () => Promise<unknown>;
}

const MemoSplitView = ({
  memos,
  getKey,
  renderMemo,
  leading,
  listFooter,
  priorityKey,
  canPaginate,
  hasNextPage,
  isFetchingNextPage,
  onFetchNext,
}: Props) => {
  const t = useTranslate();
  const { timeBasis } = useView();
  const { userTagsSetting } = useAuth();
  const listRef = useRef<HTMLUListElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (priorityKey) setSelectedKey(priorityKey);
  }, [priorityKey]);

  // A selection that left the list (deleted, archived, filtered out) falls back to the first memo.
  const selectedMemo = memos.find((memo) => getKey(memo) === selectedKey) ?? memos[0];
  const activeKey = selectedMemo ? getKey(selectedMemo) : undefined;

  const fetchIfNearEnd = useCallback(() => {
    const list = listRef.current;
    if (!list || !canPaginate || !hasNextPage || isFetchingNextPage) return;
    if (list.scrollHeight - list.scrollTop - list.clientHeight <= LIST_FETCH_THRESHOLD_PX) {
      void onFetchNext();
    }
  }, [canPaginate, hasNextPage, isFetchingNextPage, onFetchNext]);

  // The pane scrolls on its own, so the page-level auto-fetch cannot tell when it is short.
  useEffect(() => {
    fetchIfNearEnd();
  }, [fetchIfNearEnd, memos.length]);

  const select = (key: string) => {
    setSelectedKey(key);
    const detail = detailRef.current;
    if (detail && detail.getBoundingClientRect().top < 0) {
      detail.scrollIntoView({ block: "start" });
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (delta === 0 || memos.length === 0) return;
    event.preventDefault();
    const index = memos.findIndex((memo) => getKey(memo) === activeKey);
    const next = memos[Math.min(Math.max(index + delta, 0), memos.length - 1)];
    const nextKey = getKey(next);
    select(nextKey);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-memo-key="${CSS.escape(nextKey)}"]`)?.focus();
  };

  return (
    <div className="flex w-full items-start gap-4">
      <nav
        aria-label={t("memo.split-view-list")}
        className="sticky top-3 flex max-h-[calc(100svh-1.5rem)] w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card md:top-6 md:max-h-[calc(100svh-3rem)]"
      >
        <ul ref={listRef} onScroll={fetchIfNearEnd} onKeyDown={handleListKeyDown} className="min-h-0 flex-1 overflow-y-auto p-1">
          {memos.map((memo) => {
            const key = getKey(memo);
            const active = key === activeKey;
            const blurred = isMemoBlurred(memo, userTagsSetting);
            const { title, description } = blurred ? { title: "", description: "" } : getMemoListPreview(memo.content);
            const timestamp = timeBasis === "update_time" ? memo.updateTime : memo.createTime;
            return (
              <li key={key}>
                <button
                  type="button"
                  data-memo-key={key}
                  aria-current={active ? "true" : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(key)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-start transition-colors",
                    FOCUS_VISIBLE_OUTLINE_CLASSES,
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <span className={cn("w-full truncate text-sm font-medium", !title && "italic text-muted-foreground")}>
                    {blurred ? t("memo.sensitive-content") : title || t("memo.split-view-untitled")}
                  </span>
                  {description && <span className="w-full truncate text-xs text-muted-foreground">{description}</span>}
                  {timestamp && (
                    <span className="text-[11px] text-muted-foreground">
                      <RelativeTime date={timestampDate(timestamp)} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {listFooter}
      </nav>
      <div ref={detailRef} className="flex min-w-0 flex-1 scroll-mt-3 flex-col">
        {leading}
        {selectedMemo && renderMemo(selectedMemo)}
      </div>
    </div>
  );
};

export default MemoSplitView;
