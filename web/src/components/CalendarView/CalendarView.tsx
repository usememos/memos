import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { deriveDefaultCreateTimeFromDate } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import { MEMO_PANEL_INSET, MEMO_PANEL_TITLE_CLASS, MEMO_PANEL_WIDTH_CSS, MemoPanel, MemoPanelList } from "@/components/MemoPanel";
import MemoListError from "@/components/PagedMemoList/MemoListError";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useMemoFilters } from "@/hooks/useMemoFilters";
import { formatMonthLabel, getToday, parseLocalDate } from "@/lib/calendar-utils";
import { combineCELFilters } from "@/lib/cel-filter";
import { buildMemoCreatorFilter } from "@/lib/resource-names";
import { isMemoBlurred } from "@/lib/tag";
import { collectionPathForLocation } from "@/router/routes";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { buildCalendarPath, getDefaultDate } from "./paths";
import { useMonthMemos } from "./useMonthMemos";

const NO_MEMOS: Memo[] = [];
/** Page padding plus seven legible 72px columns. */
const RESERVED_BESIDE_PANEL = 48 + 7 * 72;

export interface CalendarViewProps {
  /** `YYYY-MM` */
  month: string;
  /** `YYYY-MM-DD` of the open day, if any. */
  date?: string;
}

/**
 * The signed-in user's memos as a month, scoped like Home to the remembered collection.
 * Month and day both live in the URL; this component only reads them and renders.
 *
 * The open day has two homes. From md it is the floating memo panel at the end edge; at xl
 * the grid gives way to it so every column stays legible, below xl it floats over the
 * trailing columns. Below md the grid is compact and the day's list sits under it, the way
 * phone calendars work, so a day is always shown there: today in the current month,
 * otherwise the first of the month, until the URL names one.
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
  const { memoFilter: contextFilter } = useSpaceContext();

  // The sidebar's view and tag filters narrow the month exactly as they narrow Home. They are
  // not echoed as chips here: the sidebar already shows them checked and clears them on a
  // second click, and search hands off to Home, so nothing can be active without a sidebar row.
  const viewFilter = useMemoFilters({ includeMemoViews: true, includePinned: false });
  // Statistics are already creator-scoped server-side, so leaving the creator out of their
  // filter shares the sidebar's cached query whenever no view or tag is active.
  const statsFilter = useMemo(() => combineCELFilters(contextFilter, viewFilter), [contextFilter, viewFilter]);
  const memoFilter = useMemo(() => combineCELFilters(viewFilter, user && buildMemoCreatorFilter(user.name)), [viewFilter, user]);
  const monthFilter = useMemo(() => combineCELFilters(contextFilter, memoFilter), [contextFilter, memoFilter]);

  // Statistics draw counts before the month's memos load, and are the only signal the grid
  // has for days outside the month.
  const { statistics } = useFilteredMemoStats({
    context: "home",
    userName: user?.name,
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
    enabled: Boolean(user) && isUserSettingsInitialized,
  });

  const monthLabel = useMemo(() => formatMonthLabel(month, i18n.language), [month, i18n.language]);
  const closeDay = useCallback(
    () => navigate({ pathname: collectionPathForLocation(buildCalendarPath(month), pathname), search }),
    [navigate, month, search, pathname],
  );

  const today = getToday();
  const activeDate = date ?? (md ? undefined : getDefaultDate(month, today));
  const activeMemos = (activeDate && model[activeDate]?.memos) || NO_MEMOS;
  const dateLabel = useMemo(
    () =>
      activeDate
        ? (parseLocalDate(activeDate)?.toLocaleDateString(i18n.language, { weekday: "long", month: "long", day: "numeric" }) ?? activeDate)
        : "",
    [activeDate, i18n.language],
  );
  const defaultCreateTime = useMemo(() => (activeDate ? deriveDefaultCreateTimeFromDate(activeDate) : undefined), [activeDate]);
  const [saving, setSaving] = useState(false);
  const panelOpen = Boolean(date) && md;

  const list = activeDate && (
    <MemoPanelList
      memos={activeMemos}
      selectionKey={activeDate}
      timeDisplay="time"
      compose={{
        cacheKey: `calendar-day-editor:${activeDate}`,
        label: t("calendar.new-memo-on-day"),
        defaults: { defaultCreateTime },
        onSavingChange: setSaving,
      }}
    />
  );

  // A failed month must not pass for an empty one.
  const isEmptyMonth = !isLoading && !error && Object.keys(model).length === 0;

  return (
    <>
      {/* From xl the section is viewport-tall so the grid can fill it, and pads its end edge by
          the open panel's width so the card floats beside the grid rather than over it. The
          padding reads the panel's own custom property, so it follows a resize drag live. */}
      <section
        className="flex w-full min-w-0 flex-col gap-1 xl:h-[calc(100dvh-3.5rem)]"
        style={{ paddingInlineEnd: xl && panelOpen ? `calc(${MEMO_PANEL_WIDTH_CSS} + ${MEMO_PANEL_INSET}px)` : undefined }}
      >
        <CalendarHeader month={month} monthLabel={monthLabel} today={today} activeDate={activeDate} closable={md} />
        <CalendarGrid
          month={month}
          monthLabel={monthLabel}
          today={today}
          counts={statistics.activityStats}
          model={model}
          pending={isLoading}
          selectedDate={activeDate}
          showRows={md}
        />
        {error && <MemoListError error={error} onRetry={refetch} />}
        {isEmptyMonth && md && (
          <p className="mt-2 shrink-0 text-center text-ui text-muted-foreground">
            {t("calendar.no-memos-in-month", { month: monthLabel })}
          </p>
        )}
        {activeDate && !md && (
          <section aria-label={dateLabel} className="mt-4 flex w-full flex-col">
            <header className="mb-3 border-b border-border/70 pb-3">
              <h2 className={MEMO_PANEL_TITLE_CLASS}>{dateLabel}</h2>
            </header>
            {list}
          </section>
        )}
      </section>

      {md && (
        <MemoPanel open={panelOpen} title={dateLabel} reservedWidth={RESERVED_BESIDE_PANEL} busy={saving} onClose={closeDay}>
          {list}
        </MemoPanel>
      )}
    </>
  );
};
