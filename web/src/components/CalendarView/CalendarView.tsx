import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarResizeHandle } from "@/components/AppSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useMemoFilters } from "@/hooks/useMemoFilters";
import { formatMonthLabel, getToday } from "@/lib/calendar-utils";
import { combineCELFilters } from "@/lib/cel-filter";
import { buildMemoCreatorFilter } from "@/lib/resource-names";
import { isMemoBlurred } from "@/lib/tag";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { DayPanel } from "./DayPanel";
import { buildCalendarPath, getDefaultDate } from "./paths";
import { DAY_PANEL_DEFAULT_WIDTH, DAY_PANEL_WIDTH_VAR, useDayPanelWidth } from "./useDayPanelWidth";
import { useMonthMemos } from "./useMonthMemos";

export interface CalendarViewProps {
  /** `YYYY-MM` */
  month: string;
  /** `YYYY-MM-DD` of the open day, if any. */
  date?: string;
}

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null);

/**
 * The signed-in user's memos as a month, scoped like Home to the remembered collection.
 * Month and day both live in the URL; this component only reads them and renders.
 *
 * The open day has three homes. From xl it is a resizable panel beside the grid. Between md
 * and xl the grid keeps its full width and the day slides in as a sheet from the end edge.
 * Below md the grid is compact and the day's list sits under it, the way phone calendars
 * work, so a day is always shown there: today in the current month, otherwise the first of
 * the month, until the URL names one.
 */
export const CalendarView = ({ month, date }: CalendarViewProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { search } = useLocation();
  const user = useCurrentUser();
  const md = useMediaQuery("md");
  const xl = useMediaQuery("xl");
  const panelRef = useRef<HTMLElement>(null);
  const panelWidth = useDayPanelWidth();
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
  const { model, isLoading } = useMonthMemos({
    month,
    filter: monthFilter,
    isRedacted,
    enabled: Boolean(user) && isUserSettingsInitialized,
  });

  const monthLabel = useMemo(() => formatMonthLabel(month, i18n.language), [month, i18n.language]);
  const closeDay = useCallback(() => navigate({ pathname: buildCalendarPath(month), search }), [navigate, month, search]);

  const today = getToday();
  const activeDate = date ?? (md ? undefined : getDefaultDate(month, today));

  // The sheet stays mounted after its day closes so it can slide out; it keeps showing the
  // last open day while it does.
  const [sheetDate, setSheetDate] = useState(date);
  useEffect(() => {
    if (date) setSheetDate(date);
  }, [date]);

  // Escape closes the side panel unless something else consumed it first: popups and the
  // editor both preventDefault on the Escape they handle, and text fields keep theirs.
  useEffect(() => {
    if (!date || !xl) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isEditableTarget(event.target)) return;
      closeDay();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [date, xl, closeDay]);

  const isEmptyMonth = !isLoading && Object.keys(model).length === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl items-start gap-6">
      {/* From xl the section is sticky and viewport-tall so the grid can fill it beside the panel. */}
      <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-1 xl:sticky xl:top-6 xl:h-[calc(100dvh-3.5rem)]">
        <CalendarHeader month={month} monthLabel={monthLabel} today={today} date={date} />
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
        {isEmptyMonth && md && (
          <p className="mt-2 shrink-0 text-center text-ui text-muted-foreground">
            {t("calendar.no-memos-in-month", { month: monthLabel })}
          </p>
        )}
        {activeDate && !md && (
          <div className="mt-4">
            <DayPanel date={activeDate} filter={memoFilter} />
          </div>
        )}
      </section>

      {sheetDate && md && !xl && (
        <Sheet open={Boolean(date)} onOpenChange={(open) => !open && closeDay()}>
          {/* The panel keeps its own close control in every tier, so the sheet's is hidden. */}
          <SheetContent
            side="right"
            className="w-[28rem] max-w-[90vw] gap-0 overflow-y-auto px-6 pb-8 pt-5 sm:max-w-md [&_[data-slot=sheet-close]]:hidden"
          >
            <SheetTitle className="sr-only">{sheetDate}</SheetTitle>
            <DayPanel date={sheetDate} filter={memoFilter} onClose={closeDay} />
          </SheetContent>
        </Sheet>
      )}

      {date && xl && (
        // The panel's start edge is both its separator from the grid and the resize rail, the
        // same grammar as the app sidebar's end edge; it stretches to the row so the edge runs
        // the full height of the grid, and further when the day's list is longer.
        <aside
          ref={panelRef}
          className="relative w-[var(--calendar-day-panel-width)] shrink-0 self-stretch border-s border-border/70 ps-6"
          style={{ [DAY_PANEL_WIDTH_VAR]: `${panelWidth.width}px` } as CSSProperties}
        >
          <SidebarResizeHandle
            width={panelWidth.width}
            minWidth={panelWidth.minWidth}
            maxWidth={panelWidth.maxWidth}
            onWidthChange={panelWidth.setWidth}
            targetRef={panelRef}
            cssVariable={DAY_PANEL_WIDTH_VAR}
            defaultWidth={DAY_PANEL_DEFAULT_WIDTH}
            edge="start"
            label={t("calendar.resize-panel")}
          />
          <DayPanel date={date} filter={memoFilter} onClose={closeDay} />
        </aside>
      )}
    </div>
  );
};
