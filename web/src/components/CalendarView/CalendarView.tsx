import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { deriveDefaultCreateTimeFromDate } from "@/components/MemoEditor/edit/utils/deriveDefaultCreateTime";
import { MEMO_PANEL_INSET, MEMO_PANEL_TITLE_CLASS, MEMO_PANEL_WIDTH_CSS, MemoPanel, MemoPanelList } from "@/components/MemoPanel";
import MemoListError from "@/components/PagedMemoList/MemoListError";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { MentionResolutionProvider } from "@/contexts/MentionResolutionContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useMemoFilters } from "@/hooks/useMemoFilters";
import { formatDayLabel, formatMonthLabel, getToday } from "@/lib/calendar-utils";
import { combineCELFilters } from "@/lib/cel-filter";
import { isMemoBlurred } from "@/lib/tag";
import { collectionPathForLocation } from "@/router/routes";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { PREVIEW_MIN_CELL_WIDTH } from "./CalendarDayCell";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { buildCalendarPath, getDefaultDate } from "./paths";
import { useMonthMemos } from "./useMonthMemos";

const NO_MEMOS: Memo[] = [];
const NO_CONTENTS: string[] = [];
const NO_NAMES: string[] = [];
/**
 * What the pushed grid keeps beside the panel: page padding, the grid's 2px border and seven
 * preview-wide columns. The panel already subtracts both of its insets but the push leaves only
 * one as a gap, so one comes back off. A persisted card wider than this yields for as long as
 * the window is narrow, down to its minimum.
 */
export const RESERVED_BESIDE_PANEL = 48 + 2 + 7 * PREVIEW_MIN_CELL_WIDTH - MEMO_PANEL_INSET;

export interface CalendarViewProps {
  /** `YYYY-MM` */
  month: string;
  /** `YYYY-MM-DD` of the open day, if any. */
  date?: string;
}

/**
 * The readable memos in the selected creator and Space scope, shown as a month.
 * Month and day both live in the URL; this component only reads them and renders.
 *
 * From md the month fills the viewport, its rows sharing the height. The open day has two
 * homes. From md it is the floating memo panel at the end edge; at xl the grid gives way to it
 * and the card narrows so every column keeps its preview, below xl it floats over the trailing
 * columns. Below md the grid is compact and the day's list sits
 * under it, the way phone calendars work, so a day is always shown there: today in the
 * current month, otherwise the first of the month, until the URL names one.
 */
export const CalendarView = ({ month, date }: CalendarViewProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const user = useCurrentUser();
  const md = useMediaQuery("md");
  const xl = useMediaQuery("xl");
  const { userTagsSetting, isInitialized: authInitialized, isUserSettingsInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const { memoFilter: contextFilter, creatorUsername } = useSpaceContext();

  // The sidebar's view and tag filters narrow the month exactly as they narrow Home. They are
  // not echoed as chips here: the sidebar already shows them checked and clears them on a
  // second click, and search hands off to Home, so nothing can be active without a sidebar row.
  const viewFilter = useMemoFilters({ includeMemoViews: true, includePinned: false });
  // The scope filter includes both creator and Space, and matches the sidebar statistics.
  const statsFilter = useMemo(() => combineCELFilters(contextFilter, viewFilter), [contextFilter, viewFilter]);
  const monthFilter = useMemo(() => combineCELFilters(contextFilter, viewFilter), [contextFilter, viewFilter]);

  // Statistics draw counts before the month's memos load, and are the only signal the grid
  // has for days outside the month.
  const { statistics } = useFilteredMemoStats({
    context: "collection",
    filter: statsFilter,
    enabled: authInitialized && instanceInitialized,
  });

  const isRedacted = useCallback((memo: Memo) => isMemoBlurred(memo, userTagsSetting), [userTagsSetting]);
  // Snippets and thumbnails must not appear before the tag settings that decide what to blur
  // have loaded; until then the predicate would let everything through.
  const { model, isLoading, error, refetch } = useMonthMemos({
    month,
    filter: monthFilter,
    isRedacted,
    enabled: isUserSettingsInitialized,
  });

  const monthLabel = useMemo(() => formatMonthLabel(month, i18n.language), [month, i18n.language]);
  const closeDay = useCallback(
    () => navigate({ pathname: collectionPathForLocation(buildCalendarPath(month), pathname), search }),
    [navigate, month, search, pathname],
  );

  const today = getToday();
  const activeDate = date ?? (md ? undefined : getDefaultDate(month, today));
  const activeMemos = (activeDate && model[activeDate]?.memos) || NO_MEMOS;
  const dateLabel = useMemo(() => (activeDate ? formatDayLabel(activeDate, i18n.language) : ""), [activeDate, i18n.language]);
  const defaultCreateTime = useMemo(() => (activeDate ? deriveDefaultCreateTimeFromDate(activeDate) : undefined), [activeDate]);
  const [saving, setSaving] = useState(false);
  const panelOpen = Boolean(date) && md;

  // Previews name their author only when the month really has several: one person's avatar on
  // every day says nothing, and on phones it would stand in for the mark that says what a day holds.
  const authorNames = useMemo(
    () => (creatorUsername ? NO_NAMES : Array.from(new Set(Object.values(model).flatMap((day) => day.creators)))),
    [model, creatorUsername],
  );
  const showAuthors = authorNames.length > 1;

  const canCompose = Boolean(user && (!creatorUsername || creatorUsername === user.username));
  const monthError = error && <MemoListError error={error} onRetry={refetch} />;
  // A month that is loading or failed must not pass for an empty day.
  const list = activeDate && !error && (
    <MemoPanelList
      memos={activeMemos}
      selectionKey={activeDate}
      timeDisplay="time"
      emptyText={canCompose || isLoading ? undefined : t("calendar.no-memos-on-day")}
      compose={
        canCompose
          ? {
              scope: `calendar:${activeDate}`,
              label: t("calendar.new-memo-on-day"),
              defaults: { createTime: defaultCreateTime },
              onSavingChange: setSaving,
            }
          : undefined
      }
    />
  );

  // A failed month must not pass for an empty one.
  const isEmptyMonth = !isLoading && !error && Object.keys(model).length === 0;

  return (
    <>
      {/* From md the section is viewport-tall so the grid can fill it. From xl it pads its end
          edge by the open panel's width so the card floats beside the grid rather than over it;
          the padding reads the panel's own custom property, so it follows a resize drag live. */}
      <section
        className="flex w-full min-w-0 flex-col gap-1 md:h-[calc(100dvh-3.5rem)]"
        style={{ paddingInlineEnd: xl && panelOpen ? `calc(${MEMO_PANEL_WIDTH_CSS} + ${MEMO_PANEL_INSET}px)` : undefined }}
      >
        <CalendarHeader
          month={month}
          monthLabel={monthLabel}
          today={today}
          activeDate={activeDate}
          closable={md}
          size={md ? "sm" : "md"}
          counts={statistics.activityStats}
          timeBasis={statistics.timeBasis}
        />
        {/* Above the grid, where it is in view at every size; the open panel carries it instead. */}
        {!panelOpen && monthError}
        <MentionResolutionProvider contents={NO_CONTENTS} userNames={showAuthors ? authorNames : NO_NAMES}>
          <CalendarGrid
            month={month}
            monthLabel={monthLabel}
            today={today}
            counts={statistics.activityStats}
            model={model}
            pending={isLoading}
            selectedDate={activeDate}
            showRows={md}
            showAuthors={showAuthors}
          />
        </MentionResolutionProvider>
        {isEmptyMonth && md && (
          <p className="mt-2 shrink-0 text-center mu-caption text-mu-text-secondary">
            {t("calendar.no-memos-in-month", { month: monthLabel })}
          </p>
        )}
        {list && !md && (
          <section aria-label={dateLabel} className="mt-4 flex w-full flex-col">
            <header className="mb-3 border-b border-mu-line/70 pb-3">
              <h2 className={MEMO_PANEL_TITLE_CLASS}>{dateLabel}</h2>
            </header>
            {list}
          </section>
        )}
      </section>

      {md && (
        <MemoPanel open={panelOpen} title={dateLabel} reservedWidth={RESERVED_BESIDE_PANEL} busy={saving} onClose={closeDay}>
          {monthError || list}
        </MemoPanel>
      )}
    </>
  );
};
