import { SquarePenIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromDate } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useView } from "@/contexts/ViewContext";
import { useMemoSorting } from "@/hooks";
import { getLocalDayTimestampRange, parseLocalDate, withTimestampRange } from "@/lib/calendar-utils";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

export interface DayPanelProps {
  /** `YYYY-MM-DD` */
  date: string;
  /** CEL fixing whose memos and which view or tags; the day's range is added here. */
  filter?: string;
  /** Present when the panel can be dismissed (the side panel); the inline phone list cannot. */
  onClose?: () => void;
}

/**
 * One day's memos as the ordinary paged list, so editing, reactions and comments behave
 * exactly as on Home. The composer is opt-in per day and seeds the memo's creation time to
 * that date, which is the one thing a calendar can do that the feed cannot.
 */
export const DayPanel = ({ date, filter, onClose }: DayPanelProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const { isUserSettingsInitialized } = useAuth();
  const { memoFilter: contextFilter, selectedSpaceName } = useSpaceContext();
  const { timeBasis } = useView();
  const [composing, setComposing] = useState(false);

  // Switching days closes the composer: a half-written memo must not silently move dates.
  useEffect(() => setComposing(false), [date]);

  const dayFilter = withTimestampRange(filter, getLocalDayTimestampRange(date), timeBasis);
  const { listSort, orderBy } = useMemoSorting({ pinnedFirst: false, state: State.NORMAL });
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromDate(date), [date]);

  const dateLabel = useMemo(
    () => parseLocalDate(date)?.toLocaleDateString(i18n.language, { weekday: "long", month: "long", day: "numeric" }) ?? date,
    [date, i18n.language],
  );

  const editorCacheKey = `calendar-day-editor:${date}`;

  return (
    <section aria-label={dateLabel} className="flex w-full flex-col">
      <header className="mb-3 flex items-center gap-0.5 border-b border-border/70 pb-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground">{dateLabel}</h2>
        {isUserSettingsInitialized && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("calendar.new-memo-on-day")}
            aria-pressed={composing}
            className="size-7 text-muted-foreground/70 hover:text-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            onClick={() => setComposing((value) => !value)}
          >
            <SquarePenIcon className="size-4" strokeWidth={1.8} />
          </Button>
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("calendar.close-day")}
            className="size-7 text-muted-foreground/70 hover:text-foreground"
            onClick={onClose}
          >
            <XIcon className="size-4" strokeWidth={1.8} />
          </Button>
        )}
      </header>
      <NewMemoProvider>
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <MemoView key={getMemoKey(memo)} memo={memo} showVisibility showPinned showSpace={!selectedSpaceName} compact={compact} />
          )}
          listSort={listSort}
          orderBy={orderBy}
          filter={dayFilter}
          contextFilter={contextFilter}
          emptyMessage={t("calendar.no-memos-on-day")}
          // Filters live in the sidebar on this route; see CalendarView.
          showFilters={false}
          renderLeading={() =>
            composing && isUserSettingsInitialized ? (
              <MemoEditor
                key={editorCacheKey}
                cacheKey={editorCacheKey}
                autoFocus
                className="mb-2"
                placeholder={t("editor.any-thoughts")}
                defaultCreateTime={defaultCreateTime}
                defaultSpace={selectedSpaceName}
                onConfirm={() => setComposing(false)}
                onCancel={() => setComposing(false)}
              />
            ) : null
          }
        />
      </NewMemoProvider>
    </section>
  );
};
